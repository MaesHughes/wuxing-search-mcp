/**
 * Wuxing Search — 搜索模块（精简版）
 *
 * 只做一件事：调用 SearXNG API，返回原始搜索结果。
 * 查询改写、相关性判断、内容提取等智力工作全部交给 Claude Code。
 */

import axios from 'axios';

// ==================== 配置 ====================

export const SEARCH_CONFIG = {
  searxngUrl: process.env.SEARXNG_URL || 'http://localhost:18080',
  maxResults: parseInt(process.env.MAX_RESULTS) || 20,
  timeout: parseInt(process.env.TIMEOUT) || 30000,
};

// ==================== URL 规范化 ====================

/**
 * URL 规范化：去掉 tracking 参数、统一协议、去尾部斜杠和 hash
 * 用于去重判断
 */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hash = '';
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
    for (const key of trackingParams) {
      u.searchParams.delete(key);
    }
    if (u.search === '?' || u.search === '') u.search = '';
    return u.toString();
  } catch {
    return url;
  }
}

// ==================== SearXNG 搜索 ====================

/**
 * 调用 SearXNG API 执行搜索
 *
 * @param {string} query - 搜索关键词
 * @param {object} options
 * @param {number} options.max_results - 最大返回数（默认 20）
 * @param {string} options.category - 搜索类别（general/images/videos/news/science/it/files等）
 * @param {string} options.language - 语言代码（zh/en/all）
 * @param {string} options.time_range - 时间范围（day/week/month/year/none）
 * @param {number} options.safesearch - 安全搜索级别（0-2）
 * @param {string} options.engines - 指定引擎（逗号分隔）
 * @returns {Promise<object>} { success, query, results: [{index, title, url, content, engine, score}], warnings? }
 */
export async function search(query, options = {}) {
  if (!query || !query.trim()) {
    return { success: false, query: '', results: [], warnings: ['查询不能为空'] };
  }

  const params = {
    q: query.trim(),
    format: 'json',
    language: options.language || 'all',
  };

  if (options.category && options.category !== 'general') {
    params.categories = options.category;
  }
  if (options.time_range && options.time_range !== 'none') {
    params.time_range = options.time_range;
  }
  if (options.safesearch !== undefined) {
    params.safesearch = options.safesearch;
  }
  if (options.engines) {
    params.engines = options.engines;
  }

  try {
    const response = await axios.get(`${SEARCH_CONFIG.searxngUrl}/search`, {
      params,
      timeout: SEARCH_CONFIG.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Wuxing-Search-MCP/4.0',
      },
    });

    const rawResults = response.data.results || [];
    const maxResults = options.max_results || SEARCH_CONFIG.maxResults;

    // 去重（按规范化 URL）
    const seen = new Map();
    for (const item of rawResults) {
      if (!item.url) continue;
      const normUrl = normalizeUrl(item.url);
      const existing = seen.get(normUrl);
      if (!existing || (item.score || 0) > (existing.score || 0)) {
        seen.set(normUrl, item);
      }
    }

    const deduped = Array.from(seen.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, maxResults);

    const results = deduped.map((item, index) => ({
      index: index + 1,
      title: item.title || '无标题',
      url: item.url || '',
      content: item.content || '',  // 搜索引擎返回的摘要
      engine: item.engine || 'unknown',
      score: item.score || 0,
    }));

    console.error(`[SEARCH] "${query}" → ${rawResults.length} 原始, ${deduped.length} 去重, ${results.length} 返回`);

    return {
      success: true,
      query,
      total_raw: rawResults.length,
      total_deduped: deduped.length,
      returned: results.length,
      results,
    };
  } catch (error) {
    console.error(`[SEARCH] 搜索失败: ${error.message}`);
    return {
      success: false,
      query,
      results: [],
      warnings: [`搜索失败: ${error.message}`],
    };
  }
}
