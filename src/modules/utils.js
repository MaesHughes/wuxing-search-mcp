/**
 * Wuxing Search — 共享工具函数
 * 从 searcher.js / fetcher.js / relevance.js 抽取的公共代码
 */

// ==================== 并发控制 ====================

/**
 * 带并发限制的 Promise 执行器
 * @param {Function[]} tasks - 返回 Promise 的函数数组
 * @param {number} limit - 最大并发数
 * @returns {Promise<PromiseSettledResult[]>}
 */
export async function parallelWithLimit(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const promise = task().then(result => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

// ==================== URL 工具 ====================

/**
 * 从 URL 中提取域名（去掉 www 前缀）
 * @param {string} url
 * @returns {string}
 */
export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * 从 URL 中提取域名各段（用于域名词惩罚）
 * @param {string} url
 * @returns {string[]}
 */
export function extractDomainWords(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname.split('.').filter(p => p.length > 1);
  } catch {
    return [];
  }
}
