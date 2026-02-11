#!/usr/bin/env node

/**
 * Wuxing Search MCP Server
 *
 * 基于 SearXNG 的无限制搜索 MCP Server
 * 用于课程开发场景的网页内容搜索
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// ==================== 配置 ====================

const CONFIG = {
  // SearXNG 服务地址
  searxngUrl: process.env.SEARXNG_URL || 'http://localhost:18080',
  // 默认搜索结果数量
  maxResults: parseInt(process.env.MAX_RESULTS) || 20,
  // 默认超时时间（毫秒）
  timeout: parseInt(process.env.TIMEOUT) || 30000,
};

// ==================== 工具定义 ====================

const TOOLS = [
  {
    name: 'web_search',
    description: `执行网页搜索，返回搜索结果列表。

用途：
- 搜索技术文档、教程、博客等内容
- 用于课程开发时收集参考资料
- 支持任意关键词搜索

参数说明：
- query: 搜索关键词（必需）
- max_results: 返回结果数量，默认 20，最大 100
- category: 搜索类别，可选值：general, images, videos, files, it, map, music, science, social, news
- language: 搜索语言，默认 zh-CN
- time_range: 时间范围，可选值：day, week, month, year, none（默认）
- safesearch: 安全搜索级别，可选值：0, 1, 2（默认 1）

返回格式：
- title: 结果标题
- url: 结果链接
- content: 结果摘要
- engine: 搜索引擎来源
- score: 相关性评分`,
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
          default: 'general',
        },
        language: {
          type: 'string',
          description: '搜索语言代码（如：zh、en、all）',
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

// ==================== 搜索函数 ====================

/**
 * 调用 SearXNG 搜索 API
 */
async function searchWithSearXNG(params) {
  const {
    query,
    max_results = CONFIG.maxResults,
    category = 'general',
    language = 'all',
    time_range = 'none',
    safesearch = 1,
  } = params;

  // 构建请求参数
  const searchParams = {
    q: query,
    format: 'json',
    language,
  };

  // 添加可选参数
  if (category && category !== 'general') {
    searchParams.categories = category;
  }
  if (time_range && time_range !== 'none') {
    searchParams.time_range = time_range;
  }
  if (safesearch !== undefined) {
    searchParams.safesearch = safesearch;
  }

  try {
    const response = await axios.get(`${CONFIG.searxngUrl}/search`, {
      params: searchParams,
      timeout: CONFIG.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Wuxing-Search-MCP/1.0',
      },
    });

    // 处理返回结果
    const results = response.data.results || [];
    const answers = response.data.answers || [];

    // 限制结果数量
    const limitedResults = results.slice(0, max_results);

    return {
      success: true,
      query,
      total: results.length,
      returned: limitedResults.length,
      results: limitedResults.map((item, index) => ({
        index: index + 1,
        title: item.title || '无标题',
        url: item.url || '',
        content: item.content || '',
        engine: item.engine || 'unknown',
        score: item.score || 0,
        category: item.category || 'general',
      })),
      answers: answers.length > 0 ? answers : undefined,
    };
  } catch (error) {
    throw new Error(`搜索失败: ${error.message}`);
  }
}

// ==================== MCP Server 实现 ====================

// 创建 MCP Server
const server = new Server(
  {
    name: 'wuxing-search-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'web_search': {
        const params = {
          query: args.query,
          max_results: args.max_results || 20,
          category: args.category || 'general',
          language: args.language || 'all',
          time_range: args.time_range || 'none',
          safesearch: args.safesearch || 1,
        };

        const result = await searchWithSearXNG(params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_server_info': {
        // 测试 SearXNG 服务连接
        try {
          const response = await axios.get(`${CONFIG.searxngUrl}/config`, {
            timeout: 5000,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'connected',
                    server: {
                      name: 'Wuxing Search MCP',
                      version: '1.0.0',
                      backend: 'SearXNG',
                    },
                    backend: {
                      url: CONFIG.searxngUrl,
                      instance_name: response.data.instance_name || 'unknown',
                      version: response.data.version || 'unknown',
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'disconnected',
                    server: {
                      name: 'Wuxing Search MCP',
                      version: '1.0.0',
                      backend: 'SearXNG',
                    },
                    backend: {
                      url: CONFIG.searxngUrl,
                      error: error.message,
                    },
                    hint: '请确保 SearXNG 服务正在运行',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: false,
          };
        }
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: error.message,
              tool: name,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// ==================== 启动服务器 ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr 输出启动信息（不影响 MCP 通信）
  console.error('Wuxing Search MCP Server 已启动');
  console.error(`后端 SearXNG 地址: ${CONFIG.searxngUrl}`);
  console.error(`最大结果数: ${CONFIG.maxResults}`);
  console.error(`超时时间: ${CONFIG.timeout}ms`);
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
