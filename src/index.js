#!/usr/bin/env node

/**
 * Wuxing Search MCP Server v4.0
 *
 * AI 搜索引擎 — 哑管道架构
 *
 * 核心原则：MCP Server 只做机械操作（搜索+抓取），所有智力工作交给 Claude Code。
 * - 搜索：调用 SearXNG API
 * - 抓取：axios + Readability 提取网页正文
 * - 输出：原始内容，不做评分/排序/提取/过滤
 * - Claude Code 通过 prompt 决定：搜什么、哪些有用、怎么写答案
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// 模块导入
import { search, SEARCH_CONFIG, normalizeUrl } from './modules/searcher.js';
import { fetchPages } from './modules/fetcher.js';

// ==================== Research Brief 生成 ====================

/**
 * 将搜索+抓取结果组装为 Research Brief（纯数据交付，不做任何智能处理）
 *
 * v4.0 变化：
 * - 去掉质量分级（high/medium/low）
 * - 去掉可信度标签
 * - 去掉时效性检测
 * - 去掉信息密度评分
 * - 去掉 extractor 内容提取
 * - 只返回原始内容，让 Claude Code 判断价值
 */
function buildResearchBrief(query, searchResults, fetchedPages, metadata) {
  const successPages = fetchedPages.filter(p => p.success && p.content && p.content.length > 100);
  const failedPages = fetchedPages.filter(p => !p.success || !p.content || p.content.length <= 100);

  let brief = '';

  // === 头部 ===
  brief += `# Research Brief\n\n`;
  brief += `## 用户问题\n${query}\n\n`;
  brief += `## 搜索概况\n`;
  brief += `- 搜索结果: ${searchResults.length} 条\n`;
  brief += `- 成功抓取: ${successPages.length} 页\n`;
  brief += `- 抓取失败: ${failedPages.length} 页\n`;
  brief += `- 总耗时: ${(metadata.totalTimeMs / 1000).toFixed(1)}s\n\n`;

  // === 网页内容（全部成功页面，按抓取顺序） ===
  brief += `## 搜集到的资料\n\n`;

  let sourceIndex = 0;
  for (const page of successPages) {
    sourceIndex++;
    brief += `### [${sourceIndex}] ${page.title || '无标题'}\n`;
    brief += `> 来源: ${page.url}\n\n`;
    brief += `${page.content}\n\n`;
    page._sourceNum = sourceIndex;
  }

  // === 抓取失败的页面（用搜索引擎摘要代替） ===
  if (failedPages.length > 0) {
    brief += `## 抓取失败（仅有搜索引擎摘要）\n\n`;

    for (const page of failedPages) {
      sourceIndex++;
      brief += `### [${sourceIndex}] ${page.title || '无标题'}\n`;
      brief += `> 来源: ${page.url}\n`;
      brief += `> 状态: ${page.success ? '内容过短' : (page.error || '抓取失败')}\n\n`;
      // 用搜索引擎摘要作为降级内容
      if (page.snippet && page.snippet.length > 10) {
        brief += `${page.snippet}\n\n`;
      }
      page._sourceNum = sourceIndex;
    }
  }

  // === 引用说明 ===
  brief += `---\n\n`;
  brief += `## 资料说明\n\n`;
  brief += `以上共 ${sourceIndex} 条资料，用于回答：「${query}」\n\n`;
  brief += `引用格式：使用 [编号] 标注来源，如 React 18 引入了 Concurrent Mode [3]\n`;
  brief += `来源列表格式：[编号] 标题 - URL\n`;

  return brief;
}

// ==================== 工具定义 ====================

const TOOLS = [
  {
    name: 'wuxing_search',
    description: `AI 深度搜索引擎。搜索多个网页，抓取全文内容，返回结构化 Research Brief。

【什么时候用】
- 需要深入分析的问题（"什么是..."、"如何理解..."、"对比一下..."、"为什么..."）
- 需要综合多个信息来源给出完整回答
- 写文章、写报告、做调研

【什么时候不要用】
- 查简单 API/函数/配置（用 web_search）
- 找具体链接或确认某个事实（用 web_search）

【返回内容】
Research Brief 包含：
1. 搜索概况（结果数、抓取成功/失败统计）
2. 网页全文内容（带 [1][2] 引用编号）
3. 抓取失败页面的搜索引擎摘要
4. 引用格式说明

【使用方式】
拿到 Research Brief 后，根据需求组织输出。本工具只负责数据交付，不做内容评判。`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索问题',
        },
        max_sources: {
          type: 'number',
          description: '最大抓取网页数（默认 8）',
          default: 8,
          minimum: 1,
          maximum: 12,
        },
        language: {
          type: 'string',
          description: '搜索语言偏好（zh/en/all）',
          default: 'zh',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_search',
    description: `快速网页搜索，返回搜索结果列表（标题+摘要+链接）。

【什么时候用】
- 查 API 用法、函数文档
- 找具体链接、包名、配置项
- 查错误信息、报错原因
- 搜索图片/视频
- 只需要搜索结果摘要，不需要全文

【什么时候不要用】
- 需要深入理解话题（用 wuxing_search）
- 需要写文章/报告（用 wuxing_search）

【返回内容】
搜索结果列表，每条包含 title/url/content(摘要)/engine/score。`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
        max_results: {
          type: 'number',
          description: '返回结果数量（1-100）',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
        category: {
          type: 'string',
          description: '搜索类别',
          enum: ['general', 'images', 'videos', 'files', 'it', 'map', 'music', 'science', 'social', 'news'],
        },
        language: {
          type: 'string',
          description: '搜索语言代码（zh/en/all）',
          default: 'all',
        },
        time_range: {
          type: 'string',
          description: '时间范围',
          enum: ['day', 'week', 'month', 'year', 'none'],
          default: 'none',
        },
        safesearch: {
          type: 'number',
          description: '安全搜索级别（0=关闭, 1=中等, 2=严格）',
          default: 1,
          minimum: 0,
          maximum: 2,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_server_info',
    description: '获取搜索服务器信息，包括服务状态、版本等。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ==================== MCP Server 实现 ====================

const server = new Server(
  {
    name: 'wuxing-search-mcp',
    version: '4.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ========== wuxing_search ==========
      case 'wuxing_search': {
        const query = args.query;
        const maxSources = Math.min(args.max_sources || 8, 12);
        const language = args.language || 'zh';
        const startTime = Date.now();

        console.error(`[WUXING_SEARCH] 查询: "${query}", maxSources: ${maxSources}, language: ${language}`);

        // Step 1: 搜索（直接用原始查询，不做改写）
        const { results: searchResults } = await search(query, {
          max_results: maxSources * 2,
          language: language === 'zh' ? 'all' : language,
        });

        if (!searchResults || searchResults.length === 0) {
          return {
            content: [{ type: 'text', text: `搜索 "${query}" 未找到任何结果。` }],
          };
        }

        console.error(`[WUXING_SEARCH] 搜索完成: ${searchResults.length} 条结果`);

        // Step 2: 抓取网页全文
        const fetchItems = searchResults.slice(0, maxSources + 4).map(item => ({
          index: item.index,
          url: item.url,
          title: item.title,
          snippet: item.content,
          score: item.score,
        }));

        const fetchedPages = await fetchPages(fetchItems);
        let successCount = fetchedPages.filter(p => p.success).length;
        console.error(`[WUXING_SEARCH] 抓取完成: ${successCount}/${fetchedPages.length} 成功`);

        // Step 3: 如果成功数不够，从剩余结果中补抓
        if (successCount < 4 && searchResults.length > maxSources) {
          const fetchedUrls = new Set(fetchedPages.map(p => p.url));
          const unfetched = searchResults
            .slice(maxSources)
            .filter(r => !fetchedUrls.has(r.url))
            .slice(0, 6);

          if (unfetched.length > 0) {
            const extraItems = unfetched.map(item => ({
              index: item.index,
              url: item.url,
              title: item.title,
              snippet: item.content,
              score: item.score,
            }));
            const extraPages = await fetchPages(extraItems);
            fetchedPages.push(...extraPages);
            const extraSuccess = extraPages.filter(p => p.success).length;
            console.error(`[WUXING_SEARCH] 补抓: ${extraSuccess}/${extraPages.length} 额外成功`);
          }
        }

        const totalTime = Date.now() - startTime;

        // Step 4: 组装 Research Brief（原始内容，不做任何智能处理）
        const brief = buildResearchBrief(query, searchResults, fetchedPages, {
          totalTimeMs: totalTime,
        });

        console.error(`[WUXING_SEARCH] 完成 (${brief.length} 字符, ${totalTime}ms)`);

        return {
          content: [{ type: 'text', text: brief }],
        };
      }

      // ========== web_search ==========
      case 'web_search': {
        const result = await search(args.query, {
          max_results: args.max_results || 20,
          category: args.category || 'general',
          language: args.language || 'all',
          time_range: args.time_range || 'none',
          safesearch: args.safesearch !== undefined ? args.safesearch : 1,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      // ========== get_server_info ==========
      case 'get_server_info': {
        try {
          const response = await axios.get(`${SEARCH_CONFIG.searxngUrl}/config`, {
            timeout: 5000,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'connected',
                server: { name: 'Wuxing Search MCP', version: '4.0.0', backend: 'SearXNG' },
                backend: {
                  url: SEARCH_CONFIG.searxngUrl,
                  instance_name: response.data.instance_name || 'unknown',
                  version: response.data.version || 'unknown',
                },
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'disconnected',
                server: { name: 'Wuxing Search MCP', version: '4.0.0', backend: 'SearXNG' },
                backend: { url: SEARCH_CONFIG.searxngUrl, error: error.message },
                hint: '请确保 SearXNG 服务正在运行',
              }, null, 2),
            }],
          };
        }
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    const safeError = { message: error.message, code: error.code, status: error.response?.status };
    console.error('[ERROR] 工具调用失败:', JSON.stringify(safeError));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: true, message: error.message, tool: name }, null, 2),
      }],
      isError: true,
    };
  }
});

// ==================== 启动服务器 ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
