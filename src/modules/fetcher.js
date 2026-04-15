/**
 * Wuxing Search — 网页内容抓取模块 v3
 *
 * 对标 Perplexica Researcher Agent 的抓取能力
 *
 * v1 问题：axios 裸请求，成功率 2/6（StackOverflow 403、知乎 403、超时）
 * v2 改进：UA轮换、Referer伪装、重试、域名黑名单、重定向识别
 * v3 改进：
 * - 特殊域名策略（知乎用移动端UA）
 * - 域名失败计数（连续失败达上限自动跳过）
 * - quality 字段（500字分界：high/low）
 * - 保留 engineScore 供重排序使用
 */

import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { parallelWithLimit, getDomain } from './utils.js';

// ==================== 配置 ====================

const CONFIG = {
  timeout: 10000,            // 单页超时 10s
  maxConcurrent: 3,          // 最大并发数
  maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH) || 4000, // 最大内容长度（字符），可通过环境变量配置
  minDelay: 500,             // 最小请求间隔 ms
  maxDelay: 1200,            // 最大请求间隔 ms
  maxCandidates: 12,         // 最大候选抓取数
  minSuccessTarget: 6,       // 目标成功数
  retryOnFail: true,         // 失败后重试
  qualityLow: 200,           // 低质量阈值
  qualityHigh: 1000,         // 高质量阈值（>=high 为高质量，>=low 为中等）
  domainFailLimit: 2,        // 同域名连续失败上限，达到后自动跳过
};

// ==================== UA 轮换 ====================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ==================== 特殊域名策略 ====================

/**
 * 特殊域名配置：需要特殊处理的域名
 * - mobileUA: 使用移动端 User-Agent（知乎等反爬严格的网站）
 */
const SPECIAL_DOMAINS = {
  'zhihu.com': {
    mobileUA: true,
  },
  'zhuanlan.zhihu.com': {
    mobileUA: true,
  },
};

const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
];

function getRandomMobileUA() {
  return MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];
}

// ==================== 域名失败计数 ====================

/**
 * 域名连续失败计数器
 * 同一域名连续失败达到 domainFailLimit 后自动跳过后续请求
 * key: 域名, value: { count: 连续失败次数, lastFail: 最后失败时间戳 }
 */
const domainFailCount = new Map();
const DOMAIN_FAIL_TTL = 5 * 60 * 1000; // 5 分钟后自动重置

/**
 * 记录域名抓取结果
 */
function recordDomainResult(domain, success) {
  if (success) {
    domainFailCount.delete(domain);
  } else {
    const now = Date.now();
    const existing = domainFailCount.get(domain);
    // 超过 TTL 则重新计数
    const count = (existing && (now - existing.lastFail < DOMAIN_FAIL_TTL))
      ? existing.count + 1
      : 1;
    domainFailCount.set(domain, { count, lastFail: now });
    if (count >= CONFIG.domainFailLimit) {
      console.error(`[FETCH] 域名 ${domain} 连续失败 ${count} 次，后续自动跳过`);
    }
  }
}

/**
 * 检查域名是否已达失败上限
 */
function isDomainExhausted(domain) {
  const record = domainFailCount.get(domain);
  if (!record) return false;
  // 超过 TTL 自动重置
  if (Date.now() - record.lastFail >= DOMAIN_FAIL_TTL) {
    domainFailCount.delete(domain);
    return false;
  }
  return record.count >= CONFIG.domainFailLimit;
}

/**
 * 获取指定域名的特殊UA（如有）
 */
function getSpecialUA(domain) {
  // 检查精确域名和父域名
  for (const [specialDomain, config] of Object.entries(SPECIAL_DOMAINS)) {
    if (domain === specialDomain || domain.endsWith('.' + specialDomain)) {
      if (config.mobileUA) {
        return getRandomMobileUA();
      }
    }
  }
  return null;
}

// ==================== 域名策略 ====================

/**
 * 已知无法通过 axios 抓取的域名（反爬严格）
 * 这些域名直接跳过，不浪费时间
 */
const BLOCKED_DOMAINS = [
  'twitter.com', 'x.com',
  'instagram.com',
  'facebook.com',
  'linkedin.com',
];

/**
 * 已知的搜索引擎跳转 URL 模式
 * 这些 URL 不是最终页面，而是跳转中间页
 */
function isRedirectUrl(url) {
  const redirectPatterns = [
    // 注意：weixin.sogou.com/link? 是微信公众号入口，不是纯跳转，不能拦截
    'www.sogou.com/link?',
    'baidu.com/link?',
    'so.com/link?',
    'smzdm.com/go?',
    'zhihu.com/appview/',
    'google.com/url?',
    'google.com.hk/url?',
  ];
  return redirectPatterns.some(pattern => url.includes(pattern));
}

/**
 * 检查 URL 是否可以抓取
 */
function isFetchable(url) {
  if (!url) return false;
  const domain = getDomain(url);
  if (BLOCKED_DOMAINS.includes(domain)) return false;
  if (isRedirectUrl(url)) return false;
  // 跳过非 HTTP(S) 协议
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  return true;
}

// ==================== Cookie Jar ====================

/**
 * 创建带 Cookie 的 axios 实例
 * 模拟浏览器会话，提高反爬通过率
 */
function createHttpClient(ua, isMobile) {
  const userAgent = ua || getRandomUA();
  return axios.create({
    timeout: CONFIG.timeout,
    maxRedirects: 5,
    decompress: true,
    headers: {
      'User-Agent': userAgent,
      ...(isMobile ? {
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
      } : {
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
      }),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });
}

// ==================== 文本处理 ====================

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[\r\n]+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\u00A0\u200B\u200C\u200D\ufeff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;

  let truncated = text.slice(0, maxLength);

  const lastPunctuation = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
  );

  if (lastPunctuation > maxLength * 0.5) {
    truncated = truncated.slice(0, lastPunctuation + 1);
  }

  return truncated + '\n...(内容已截断)';
}

/**
 * 随机延迟
 */
function randomDelay(min, max) {
  const ms = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 核心抓取 ====================

/**
 * 抓取单个网页（带重试和 Referer 伪装）
 */
export async function fetchPage(url, options = {}) {
  const { timeout, maxContentLength, referer } = { ...CONFIG, ...options };

  if (!isFetchable(url)) {
    return {
      title: '',
      content: '',
      excerpt: '',
      success: false,
      error: 'URL 不可抓取（重定向链接或黑名单域名）',
      skipped: true,
      quality: 'low',
    };
  }

  const domain = getDomain(url);

  // 检查域名是否已达失败上限
  if (isDomainExhausted(domain)) {
    console.error(`[FETCH] 跳过失败域名: ${domain}`);
    return {
      title: '',
      content: '',
      excerpt: '',
      success: false,
      error: `域名 ${domain} 连续失败已达上限，自动跳过`,
      skipped: true,
      quality: 'low',
    };
  }

  // 检查是否需要特殊UA
  const specialUA = getSpecialUA(domain);
  const isMobile = !!specialUA;

  // 尝试抓取（最多 2 次，第二次换 UA）
  for (let attempt = 0; attempt < 2; attempt++) {
    const ua = attempt === 0 ? specialUA : getRandomUA();
    const client = createHttpClient(ua, attempt === 0 ? isMobile : false);

    // 第二次尝试加 Referer
    if (attempt > 0 || referer) {
      const ref = referer || `https://www.google.com/search?q=${encodeURIComponent(domain)}`;
      client.defaults.headers['Referer'] = ref;
    }

    try {
      const response = await client.get(url, {
        validateStatus: (status) => status < 400,
      });

      const html = response.data;
      if (!html || typeof html !== 'string') {
        recordDomainResult(domain, false);
        return {
          title: '',
          content: '',
          excerpt: '',
          success: false,
          error: '响应内容为空',
          quality: 'low',
        };
      }

      // JSDOM → Readability
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        const bodyText = dom.window.document.body?.textContent || '';
        const cleaned = cleanText(bodyText);
        if (cleaned.length > 100) {
          recordDomainResult(domain, true);
          return {
            title: dom.window.document.title || '',
            content: truncateText(cleaned, maxContentLength),
            excerpt: cleaned.slice(0, 200),
            success: true,
            method: 'fallback-text',
            quality: cleaned.length >= CONFIG.qualityHigh ? 'high' : cleaned.length >= CONFIG.qualityLow ? 'medium' : 'low',
          };
        }
        // 内容太短，第二次尝试
        if (attempt === 0) continue;
        recordDomainResult(domain, false);
        return {
          title: dom.window.document.title || '',
          content: truncateText(cleaned, maxContentLength),
          excerpt: cleaned.slice(0, 200),
          success: false,
          error: 'Readability 解析失败且正文过短',
          quality: 'low',
        };
      }

      const content = cleanText(article.textContent);
      if (content.length < 100) {
        if (attempt === 0) continue;
        recordDomainResult(domain, false);
        return {
          title: article.title || '',
          content: truncateText(content, maxContentLength),
          excerpt: article.excerpt || '',
          success: false,
          error: `正文过短 (${content.length}字)`,
          quality: 'low',
        };
      }

      recordDomainResult(domain, true);
      return {
        title: article.title || '',
        content: truncateText(content, maxContentLength),
        excerpt: article.excerpt || content.slice(0, 200),
        success: true,
        contentLength: content.length,
        method: 'readability',
        quality: content.length >= CONFIG.qualityHigh ? 'high' : content.length >= CONFIG.qualityLow ? 'medium' : 'low',
      };
    } catch (error) {
      // 第一次失败，重试；第二次失败，返回错误
      if (attempt === 0 && CONFIG.retryOnFail) {
        console.error(`[FETCH] [${domain}] 第1次失败: ${error.code || error.message}，重试中...`);
        await randomDelay(500, 1000);
        continue;
      }
      recordDomainResult(domain, false);
      return {
        title: '',
        content: '',
        excerpt: '',
        success: false,
        error: `${error.code || 'ERROR'}: ${error.message}`,
        quality: 'low',
      };
    }
  }
}

// ==================== 批量抓取 ====================

/**
 * 批量并发抓取多个网页（v3：智能过滤 + 域名失败跳过 + quality + engineScore）
 *
 * @param {Array<{ index: number, url: string, title?: string, snippet?: string, score?: number }>} items
 * @param {object} options
 * @returns {Promise<Array>}
 */
export async function fetchPages(items, options = {}) {
  const { maxConcurrent, minDelay, maxDelay } = { ...CONFIG, ...options };

  // 过滤：跳过不可抓取的 URL + 域名去重
  const seenDomains = new Set();
  const candidates = [];

  for (const item of items) {
    if (!isFetchable(item.url)) {
      console.error(`[FETCH] 跳过不可抓取: ${item.url.slice(0, 80)}`);
      continue;
    }
    const domain = getDomain(item.url);

    // 跳过已达失败上限的域名
    if (isDomainExhausted(domain)) {
      console.error(`[FETCH] 跳过失败域名: ${domain}`);
      continue;
    }
    // 同一域名最多抓 2 个页面（反爬严格的域名只抓 1 个）
    const isStrictDomain = SPECIAL_DOMAINS.hasOwnProperty(domain) ||
      domain.endsWith('.zhihu.com') || domain.endsWith('.weibo.com');
    const domainLimit = isStrictDomain ? 1 : 2;
    const domainCount = candidates.filter(c => getDomain(c.url) === domain).length;
    if (domainCount >= domainLimit) {
      console.error(`[FETCH] 跳过重复域名: ${domain}`);
      continue;
    }
    candidates.push(item);
    if (candidates.length >= CONFIG.maxCandidates) break;
  }

  console.error(`[FETCH] 候选: ${items.length} → 过滤后: ${candidates.length}`);

  const tasks = candidates.map((item, i) => {
    return async () => {
      if (i > 0) await randomDelay(minDelay, maxDelay);

      // 并发安全：执行前再次检查域名失败状态
      // （前面的并发 task 可能已经将此域名标记为失败）
      const domain = getDomain(item.url);
      if (isDomainExhausted(domain)) {
        console.error(`[FETCH] 跳过已失败域名: ${domain} (并发跳过)`);
        return {
          index: item.index,
          url: item.url,
          title: item.title || '',
          snippet: item.snippet || '',
          engineScore: item.score || 0,
          content: '',
          excerpt: '',
          success: false,
          error: `域名 ${domain} 在本批次中已失败，跳过`,
          skipped: true,
          quality: 'low',
        };
      }

      const startTime = Date.now();
      const result = await fetchPage(item.url, options);
      const elapsed = Date.now() - startTime;

      const status = result.skipped ? '跳过' : (result.success ? 'OK' : 'FAIL');
      console.error(
        `[FETCH] [${item.index}] ${status} ${item.url.slice(0, 70)} (${elapsed}ms, ${result.content.length}字)${result.error && !result.skipped ? ` ${result.error}` : ''}`
      );

      return {
        index: item.index,
        url: item.url,
        title: item.title || result.title || '',
        snippet: item.snippet || '',
        engineScore: item.score || 0,
        ...result,
      };
    };
  });

  const settled = await parallelWithLimit(tasks, maxConcurrent);

  const results = [];
  let successCount = 0;

  for (const { status, value } of settled) {
    if (status === 'fulfilled') {
      results.push(value);
      if (value.success) successCount++;
    }
  }

  console.error(`[FETCH] 完成: ${successCount}/${candidates.length} 成功`);
  return results;
}
