# Wuxing Search MCP - 一键安装指南

## 🚀 快速开始

### 前置要求

- **Docker**（必需）：[安装指南](https://docs.docker.com/get-docker/)
- **Node.js 18+**（必需）：[下载地址](https://nodejs.org/)

### 一键安装（推荐）

#### Windows

```powershell
# 1. 克隆或下载项目
git clone https://github.com/your-username/wuxing-search-mcp.git
cd wuxing-search-mcp

# 2. 运行一键安装脚本
.\install.ps1
```

#### Linux / macOS

```bash
# 1. 克隆或下载项目
git clone https://github.com/your-username/wuxing-search-mcp.git
cd wuxing-search-mcp

# 2. 运行一键安装脚本
chmod +x install.sh
./install.sh
```

### 安装脚本会自动完成：

1. ✅ 检查 Docker 环境
2. ✅ 安装 MCP Server 依赖
3. ✅ 清理旧容器（如果存在）
4. ✅ 启动 SearXNG 搜索引擎
5. ✅ 生成 Claude Code 配置指南

### 配置 Claude Code

安装完成后，脚本会显示配置指南，按以下步骤操作：

#### 1. 打开配置文件

**Windows**：
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS / Linux**：
```
~/.config/Claude/claude_desktop_config.json
```

#### 2. 添加配置

```json
{
  "mcpServers": {
    "wuxing-search": {
      "command": "node",
      "args": ["D:\\path\\to\\wuxing-search-mcp\\src\\index.js"],
      "env": {
        "SEARXNG_URL": "http://localhost:8888"
      }
    }
  }
}
```

**注意**：将路径 `D:\\path\\to\\wuxing-search-mcp\\src\\index.js` 替换为实际的项目路径。

#### 3. 重启 Claude Code

完全退出 Claude Code 并重新打开。

### 开始使用

在 Claude Code 中输入：

```
请搜索最新的 AI 编程工具
```

---

## 📋 手动安装（不推荐）

如果一键安装脚本无法使用，可以手动执行以下步骤：

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 SearXNG

**方式 A：使用 Docker Compose（推荐）**

```bash
docker-compose up -d
```

**方式 B：使用 Docker 命令**

```bash
docker run -d \
  --name wuxing-searxng \
  --restart unless-stopped \
  -p 8888:8080 \
  -v "$(pwd)/searxng/config:/etc/searxng/" \
  -v "$(pwd)/searxng/data:/var/cache/searxng/" \
  searxng/searxng:latest
```

### 3. 验证服务

```bash
# 检查 SearXNG
curl http://localhost:8888

# 检查 MCP Server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node src/index.js
```

### 4. 配置 Claude Code

参考上面的"配置 Claude Code"部分。

---

## 🔧 管理命令

### SearXNG 管理

```bash
# 查看状态
npm run status:searxng

# 查看日志
npm run logs:searxng

# 重启服务
npm run restart:searxng

# 停止服务
npm run stop:searxng

# 启动服务
npm run start:searxng

# 测试搜索
npm run test:searxng
```

### Docker 原生命令

```bash
# 查看容器状态
docker ps | grep wuxing-searxng

# 查看日志
docker logs -f wuxing-searxng

# 重启容器
docker restart wuxing-searxng

# 停止容器
docker stop wuxing-searxng

# 启动容器
docker start wuxing-searxng
```

---

## 🛠️ 故障排查

### 问题 1：Docker 未安装或未运行

**症状**：
```
❌ Docker 未安装
❌ Docker 服务未运行
```

**解决方案**：
1. 安装 Docker Desktop：https://www.docker.com/products/docker-desktop
2. 启动 Docker Desktop
3. 验证：`docker --version`

### 问题 2：SearXNG 容器启动失败

**症状**：
```
❌ SearXNG 容器启动失败
```

**解决方案**：
```bash
# 查看详细日志
docker logs wuxing-searxng

# 重新创建容器
docker stop wuxing-searxng && docker rm wuxing-searxng
docker-compose up -d

# 或使用 Docker 命令
docker run -d --name wuxing-searxng -p 8888:8080 \
  -v "$(pwd)/searxng/config:/etc/searxng/" \
  -v "$(pwd)/searxng/data:/var/cache/searxng/" \
  searxng/searxng:latest
```

### 问题 3：端口 8888 被占用

**症状**：
```
Error: port 8888 already in use
```

**解决方案**：
```bash
# Windows
netstat -ano | findstr :8888
# 找到进程 PID 后，taskkill /PID <pid> /F

# Linux/Mac
lsof -ti:8888 | xargs kill -9

# 或修改端口
docker run -d --name wuxing-searxng -p 9999:8080 ...
# 然后更新配置中的 SEARXNG_URL=http://localhost:9999
```

### 问题 4：MCP 工具不可用

**症状**：Claude Code 中搜索工具不显示或报错

**检查清单**：
1. ✅ SearXNG 容器是否运行：`docker ps | grep wuxing-searxng`
2. ✅ SearXNG 服务是否正常：`curl http://localhost:8888`
3. ✅ 配置文件路径是否正确（使用绝对路径）
4. ✅ Node.js 版本是否 >= 18：`node --version`
5. ✅ Claude Code 是否重启

**测试 MCP Server**：
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node src/index.js
```

### 问题 5：搜索返回连接错误

**症状**：
```
搜索失败: Request failed with status code 500
```

**解决方案**：
```bash
# 1. 检查 SearXNG 日志
docker logs wuxing-searxng --tail 50

# 2. 重启 SearXNG
docker restart wuxing-searxng

# 3. 等待 5-10 秒后重试
```

---

## 📊 工作原理

```
用户 → Claude Code → MCP Server (Node.js) → SearXNG (Docker) → 搜索引擎
```

**组件说明**：

| 组件 | 技术栈 | 作用 | 依赖 |
|------|--------|------|------|
| MCP Server | Node.js | 实现 MCP 协议 | npm install |
| SearXNG | Python/Docker | 聚合搜索引擎 | Docker |

---

## 🔒 安全说明

- SearXNG 运行在本地 Docker 容器中，数据不会离开你的机器
- 搜索请求通过 SearXNG 聚合多个搜索引擎，不直接暴露你的 IP
- 默认配置已禁用限速器（`limiter: false`），支持高频搜索

---

## 📦 更新

### 更新 MCP Server

```bash
git pull
npm install
```

### 更新 SearXNG

```bash
docker pull searxng/searxng:latest
docker stop wuxing-searxng && docker rm wuxing-searxng
docker-compose up -d
```

---

## 💡 使用技巧

### 1. 搜索最新内容

```
请搜索最近一周的 AI 编程工具
```

### 2. 搜索特定类别

```
请搜索 React 相关的视频教程
```

### 3. 搜索特定语言

```
请搜索 Python 机器学习库
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

## 🆘 获取帮助

- GitHub Issues: https://github.com/your-username/wuxing-search-mcp/issues
- 文档: https://github.com/your-username/wuxing-search-mcp#readme
