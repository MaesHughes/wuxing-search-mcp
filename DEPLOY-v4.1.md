# v4.1 搜索可用性优化 — 部署指南

## 改动概述

本次改动通过**配置优化 + 多实例 Fallback** 提升搜索可用性，不增加任何外部依赖和费用。

---

## 修改的文件（共 3 个）

### 1. `searxng/config/settings.yml`

SearXNG 容器配置，通过 Docker volume 挂载生效。

```yaml
outgoing:
  request_timeout: 6.0       # 原值 10.0 → 改为 6.0，被封引擎快速失败
  max_request_timeout: 15.0  # 新增，允许个别慢引擎最多 15s
  pool_connections: 100      # 不变
  pool_maxsize: 20           # 不变
  suspension_time: 600       # 新增，被封引擎 10 分钟后自动恢复（原默认 86400 秒 = 24 小时）

engines:
  # 禁用高风险引擎（容易触发 CAPTCHA/403）
  - name: google
    disabled: true
  - name: startpage
    disabled: true

  # 启用稳定的独立索引引擎
  - name: brave
    disabled: false
  - name: mojeek
    disabled: false
  - name: duckduckgo
    disabled: false

  # 通用备选
  - name: yahoo
    disabled: false
  - name: qwant
    disabled: false

  # 中文引擎
  - name: 360search
    disabled: false
  - name: baidu kaifa
    disabled: false
  - name: sogou wechat
    disabled: false
```

**关键参数说明：**

| 参数 | 原值 | 新值 | 作用 |
|------|------|------|------|
| `request_timeout` | 10.0s | 6.0s | 慢引擎/被封引擎不拖住整体搜索 |
| `suspension_time` | 86400s(24h) | 600s(10min) | 被封引擎更快自动恢复 |
| `max_request_timeout` | 无 | 15.0s | 允许个别慢引擎多一点时间 |
| google | 启用 | 禁用 | 减少 403/CAPTCHA 封禁 |
| startpage | 启用 | 禁用 | 容易触发 Google CAPTCHA |

### 2. `src/modules/searcher.js`

MCP 搜索模块，新增多实例 Fallback 机制。

**新增内容：**

```javascript
// 公共 SearXNG 实例列表（fallback 用）
const PUBLIC_INSTANCES = [
  'https://searx.be',
  'https://searxng.ch',
  'https://search.mdosch.de',
];

export const SEARCH_CONFIG = {
  searxngUrl: primaryUrl,                          // 保持向后兼容
  searxngUrls: [primaryUrl, ...PUBLIC_INSTANCES],  // 新增：多实例列表
  maxResults: 20,
  timeout: 30000,
  instanceTimeout: 8000,  // 新增：单实例最多等 8s
};
```

**Fallback 逻辑：**
- 本地 SearXNG 优先（localhost:18080）
- 本地失败/超时/无结果 → 自动尝试 searx.be
- 再失败 → searxng.ch → search.mdosch.de
- 全部失败才返回错误

### 3. `src/index.js`

`get_server_info` 工具更新，展示所有实例的连接状态。

---

## 另一台笔记本部署步骤

### 前提
两个笔记本通过 git 仓库同步代码。

### 步骤 1：拉取代码

```bash
cd <项目目录>
git pull origin master
```

### 步骤 2：重启 SearXNG Docker 容器

settings.yml 是通过 Docker volume 挂载的，重启容器即可生效：

```bash
docker stop wuxing-searxng && docker rm wuxing-searxng && docker compose up -d
```

### 步骤 3：重启 Claude Code

关闭所有 Claude Code 实例，重新打开。MCP Server 会自动加载新代码。

### 步骤 4：验证

在 Claude Code 中执行：
```
使用 get_server_info 工具检查连接状态
```

期望输出：
- 本地实例 status: connected
- 公共实例 status: disconnected（正常，公共实例不稳定）
- fallback_enabled: true

---

## 回滚方案

如果出现问题，回滚只需两步：

```bash
# 1. 回退代码
git checkout HEAD~1 -- searxng/config/settings.yml src/modules/searcher.js src/index.js

# 2. 重启容器
docker stop wuxing-searxng && docker rm wuxing-searxng && docker compose up -d
```

---

## 注意事项

1. **Google 引擎已禁用**：如需重新启用，在 `settings.yml` 中将 google 的 `disabled: true` 改为 `disabled: false` 或删除该项，然后重启容器
2. **公共实例不稳定**：3 个公共实例仅作为 fallback 兜底，连接状态显示 disconnected 是正常的
3. **suspension_time 可调**：如果觉得 10 分钟恢复太频繁，可以改为 1800（30分钟）或 3600（1小时）
