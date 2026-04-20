<p align="center">
  <img src="assets/banner.png" alt="Wuxing Search MCP Banner" width="100%">
</p>

<p align="center">
  <a href="README.md">
    <b>English | 中文</b>
  </a>
</p>

<p align="center">
  <strong>Compatible with Claude Code, Cursor, Windsurf, and other AI-powered IDEs</strong>
</p>

<h1 align="center">Wuxing Search MCP</h1>

<p align="center">
  <i>Unlimited Search MCP Server Powered by SearXNG</i>
</p>

<p align="center">
  <strong>A powerful, unlimited search server that aggregates 100+ search engines</strong>
</p>

<p align="center">
  <a href="https://github.com/MaesHughes/wuxing-search-mcp">
    <img src="https://img.shields.io/github/stars/MaesHughes/wuxing-search-mcp?style=flat-square" alt="stars">
  </a>
  <a href="https://github.com/MaesHughes/wuxing-search-mcp/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-purple?style=flat-square" alt="license">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="node version">
  <img src="https://img.shields.io/badge/docker-supported-blue?style=flat-square" alt="docker">
  <img src="https://img.shields.io/badge/MCP-Compatible-success?style=flat-square" alt="mcp">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-management">Management</a> •
  <a href="#-troubleshooting">Troubleshooting</a>
</p>

---

## What is Wuxing Search MCP?

**Wuxing Search MCP** is a powerful, unlimited search server built on top of [SearXNG](https://searxng.org/). It integrates seamlessly with [Claude Code](https://claude.ai/code) via the Model Context Protocol, providing free and unlimited search capabilities by aggregating results from 100+ search engines.

### Why Wuxing Search?

Traditional search APIs have limitations:
- ❌ Rate limits and quotas
- ❌ Expensive API costs
- ❌ Single source results

**Wuxing Search solves all of this:**
- ✅ **Completely Free** - Self-hosted SearXNG, no API costs
- ✅ **Unlimited Searches** - Rate limiter disabled for high-frequency searching
- ✅ **Multi-Source Aggregation** - Google, Bing, DuckDuckGo, Brave, and 100+ engines
- ✅ **Privacy Friendly** - No tracking, no logging
- ✅ **MCP Integrated** - Perfect for Claude Code workflow

---

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌─────────────┐
│  You        │ ───▶ │ Claude Code │ ───▶ │ Wuxing      │ ───▶ │  SearXNG    │
│  (User)     │      │  (MCP Client) │      │ Search MCP   │      │ (Docker)    │
└─────────────┘      └──────────────┘      │ (Node.js)   │      │ (Python)    │
                                            └──────────────┘      └─────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────────────────┐
                                            │   Search Engine Aggregator│
                                            │   General: Google, Bing..│
                                            │   Code: GitHub, HuggingFace│
                                            │   Q&A: StackOverflow      │
                                            │   Packages: npm, PyPI     │
                                            │   Academic: arXiv         │
                                            │   Community: HN, Reddit   │
                                            │   And 100+ more...        │
                                            └───────────────────────────┘
```

---

## Features

### ✨ Current Features

- **🔍 Unlimited Web Search**
  - No API rate limits or quotas
  - Support for high-frequency searching
  - Configurable result count (1-100)

- **🌐 Multi-Source Aggregation**
  - General: Google, Bing, DuckDuckGo, Baidu
  - Code: GitHub, Hugging Face, GitLab
  - Q&A: Stack Overflow
  - Packages: npm, PyPI, crates.io, Docker Hub
  - Academic: arXiv, Google Scholar, Semantic Scholar, PubMed
  - Community: HackerNews, Reddit, Mastodon
  - Docs: MDN
  - News: Google News
  - 100+ search engines supported

- **📊 Advanced Search Options**
  - Time range filtering (day, week, month, year)
  - Category filtering (general, images, videos, news, it, science, files, social)
  - Language filtering
  - Safe search levels

- **🔌 MCP Integration**
  - Seamless Claude Code integration
  - stdio communication (no network ports for MCP)
  - JSON-RPC 2.0 protocol

- **🐳 Easy Deployment**
  - Docker-based SearXNG deployment
  - One-command installation
  - Cross-platform support (Windows, macOS, Linux)

- **🔒 Privacy First**
  - No tracking, no logging
  - Self-hosted, data never leaves your machine
  - Anonymous search requests via SearXNG

---

## Quick Start

Get started in 4 simple steps:

### Prerequisites

- **Docker** (required): [Download](https://www.docker.com/products/docker-desktop)
- **Node.js 18+** (required): [Download](https://nodejs.org/)

### 1. Clone the Project

```bash
git clone https://github.com/MaesHughes/wuxing-search-mcp.git
cd wuxing-search-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start SearXNG

**Option A: Using Docker Command (Recommended)**

```bash
docker run -d \
  --name wuxing-searxng \
  --restart unless-stopped \
  -p 18080:8080 \
  -v "$(pwd)/searxng/config:/etc/searxng/" \
  -v "$(pwd)/searxng/data:/var/cache/searxng/" \
  searxng/searxng:latest
```

**Option B: Using Docker Compose**

```bash
docker-compose up -d
```

### 4. Configure Claude Code

Find your Claude Code config file:

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS / Linux**:
```
~/.config/Claude/claude_desktop_config.json
```

### Step 1: Get Your Project Path

Run the following command in your project directory to get the absolute path:

**Windows (PowerShell):**
```powershell
Resolve-Path src\index.js
```

**Windows (Git Bash / Bash):**
```bash
pwd -W && echo "/src/index.js"
# Or manually combine: $(pwd -W)/src/index.js
```

**macOS / Linux:**
```bash
pwd && echo "/src/index.js"
# Or manually combine: $(pwd)/src/index.js
```

### Step 2: Add Configuration

Add the following configuration to your config file. **⚠️ Make sure to replace `YOUR_FULL_PATH_HERE` with the actual path from the step above:**

#### Windows Configuration Example

```json
{
  "mcpServers": {
    "wuxing-search": {
      "type": "stdio",
      "command": "cmd",
      "args": [
        "/c",
        "node",
        "D:\\\\path\\\\to\\\\wuxing-search-mcp\\\\src\\\\index.js"
      ],
      "env": {
        "SEARXNG_URL": "http://localhost:18080",
        "MAX_RESULTS": "20",
        "TIMEOUT": "30000"
      }
    }
  }
}
```

#### macOS / Linux Configuration Example

```json
{
  "mcpServers": {
    "wuxing-search": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/home/username/wuxing-search-mcp/src/index.js"
      ],
      "env": {
        "SEARXNG_URL": "http://localhost:18080",
        "MAX_RESULTS": "20",
        "TIMEOUT": "30000"
      }
    }
  }
}
```

**Configuration Reference:**

| Option | Windows | macOS/Linux | Description |
|--------|---------|-------------|-------------|
| `type` | `"stdio"` | `"stdio"` | Communication protocol type |
| `command` | `"cmd"` | `"node"` | Windows uses cmd wrapper |
| `args` | `["/c", "node", "path..."]` | `["path..."]` | Must use absolute path |
| `env.SEARXNG_URL` | SearXNG service address | - | Default: `http://localhost:18080` |
| `env.MAX_RESULTS` | Default result count | - | Default: 20, range 1-100 |
| `env.TIMEOUT` | Request timeout (ms) | - | Default: 30000 |

**⚠️ Important Notes:**
- Windows backslashes must be escaped as double backslashes `\\\\` (JSON format requirement)
- Or use forward slashes `/` (also works on Windows)
- Path must be absolute - relative paths will not work
- Completely restart Claude Code after modifying configuration

### 5. Restart Claude Code

Completely quit and reopen Claude Code.

---

## Usage

### Basic Search

Simply ask in Claude Code:

```
Search for the latest AI programming tools
```

### Advanced Search with Parameters

You can specify parameters:

```
Search for React tutorials from the past week, return 10 results
```

### Available Tools

#### 1. web_search

Execute web searches and return results.

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `query` | Search keywords | Yes | - |
| `max_results` | Number of results (1-100) | No | 20 |
| `category` | Search category | No | general |
| `language` | Language code | No | all |
| `time_range` | Time range filter | No | none |
| `safesearch` | Safe search level (0-2) | No | 1 |

**Category Options:**
- `general` - General search
- `images` - Image search
- `videos` - Video search
- `news` - News search
- `it` - IT & Technology
- `science` - Science
- `files` - Files
- `social` - Social media

**Time Range Options:**
- `day` - Past 24 hours
- `week` - Past week
- `month` - Past month
- `year` - Past year
- `none` - No time filter

#### 2. get_server_info

Get search server status information. No parameters.

### Usage Examples

#### Example 1: Search for Documentation

```
Search for OpenCode official documentation and tutorials
```

#### Example 2: Search Latest Content

```
Search for articles about AI Agent from the past week
```

#### Example 3: Search Specific Category

```
Search for Python machine learning library video tutorials
```

#### Example 4: Check Server Status

```
Check search server status
```

---

## Management

### NPM Commands

```bash
# View SearXNG status
npm run status:searxng

# View SearXNG logs
npm run logs:searxng

# Restart SearXNG
npm run restart:searxng

# Stop SearXNG
npm run stop:searxng

# Start SearXNG
npm run start:searxng

# Test search service
npm run test:searxng
```

### Docker Commands

```bash
# View container status
docker ps | grep wuxing-searxng

# View real-time logs
docker logs -f wuxing-searxng

# Restart service
docker restart wuxing-searxng

# Stop service
docker stop wuxing-searxng

# Start service
docker start wuxing-searxng

# Delete and recreate
docker stop wuxing-searxng && docker rm wuxing-searxng
# Then re-run the start command
```

---

## Configuration

Configure the MCP Server through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SEARXNG_URL` | SearXNG service address | http://localhost:18080 |
| `MAX_RESULTS` | Default number of results | 20 |
| `TIMEOUT` | Request timeout (ms) | 30000 |

Add these variables in the `env` field of your Claude Code configuration.

---

## Troubleshooting

### Problem 1: Search Tool Not Showing or Error

**Checklist:**

1. ✅ Is SearXNG container running?
   ```bash
   docker ps | grep wuxing-searxng
   ```

2. ✅ Is SearXNG service healthy?
   ```bash
   curl http://localhost:18080
   ```

3. ✅ Is config file path correct (use absolute path)?

4. ✅ Is Node.js version >= 18?
   ```bash
   node --version
   ```

5. ✅ Has Claude Code been restarted?

### Problem 2: SearXNG Container Won't Start

**Check:**

1. Is port 18080 occupied?
   ```bash
   # Windows
   netstat -ano | findstr :18080

   # Linux/Mac
   lsof -ti:18080
   ```

2. Is Docker service running?

3. View container logs:
   ```bash
   docker logs wuxing-searxng
   ```

**Solution:**

```bash
# Delete old container and recreate
docker stop wuxing-searxng && docker rm wuxing-searxng
# Then re-run the start command
```

### Problem 3: Search Returns Connection Error

**Possible Cause:** SearXNG service not fully started

**Solution:**

```bash
# Wait 5-10 seconds and retry
# Or restart SearXNG
docker restart wuxing-searxng
```

### Problem 4: Results Contain Old Content

**Cause:** Time filtering depends on search engine support

**Solution:**

1. Use shorter time ranges (`day` instead of `week`)
2. Add explicit time keywords in query (e.g., `January 2025`)
3. Combine both approaches:
   ```
   Search for React new features in January 2025
   ```

---

## Technical Architecture

### MCP Server (Node.js)

- **File:** `src/index.js`
- **Dependencies:** @modelcontextprotocol/sdk, axios
- **Communication:** stdio (standard input/output)
- **Role:** Implement MCP protocol, forward requests to SearXNG

### SearXNG (Python/Docker)

- **Image:** searxng/searxng:latest
- **Port:** 18080 (host) → 8080 (container)
- **Config:** searxng/config/settings.yml
- **Data:** searxng/data/ (cache)
- **Role:** Aggregate 100+ search engines

### Data Flow

```
User Input
  → Claude Code
  → MCP Server (stdio)
  → HTTP request to SearXNG
  → Parallel requests to search engines
  → Aggregate results
  → Return to user
```

---

## Project Structure

```
wuxing-search-mcp/
├── src/                  # MCP Server source
│   └── index.js         # Main MCP Server implementation
├── searxng/             # SearXNG configuration
│   ├── config/          # SearXNG settings.yml
│   └── data/            # SearXNG cache (auto-created)
├── assets/              # Documentation images
│   └── banner.png       # Project banner
├── package.json         # NPM package configuration
├── docker-compose.yml   # Docker Compose configuration
├── install.sh           # Linux/Mac installation script
├── install.ps1          # Windows installation script
├── README.md            # This file (English)
├── README.zh-CN.md      # Chinese version
└── INSTALL.md           # Detailed installation guide
```

---

## FAQ

### Q: Why is Docker required?

**A:** SearXNG is a Python project with 50+ Python package dependencies. Docker provides:
- Avoid complex manual dependency installation
- Environment isolation
- Simplified deployment and updates

### Q: Can I skip Docker?

**A:** Theoretically yes, but not recommended. You would need to:
1. Install Python 3.14
2. Manually install 50+ Python dependencies
3. Configure Python environment

The Docker approach is much simpler and more reliable.

### Q: Are there search limits?

**A:** No! This is the core advantage of this project:
- Completely self-hosted
- No API call limits
- No request rate limits

### Q: Which search engines are supported?

**A:** SearXNG supports 245 search engines, with 89 enabled by default.

**Currently Enabled (21 engines):**

| Category | Search Engines |
|----------|----------------|
| **General** | Google, Bing, DuckDuckGo, Baidu |
| **Code Repos** | GitHub, Hugging Face, GitLab |
| **Q&A** | Stack Overflow |
| **Packages** | npm, PyPI, crates.io, Docker Hub |
| **Academic** | arXiv, Google Scholar, Semantic Scholar, PubMed |
| **Community** | HackerNews, Reddit, Mastodon |
| **Docs** | MDN Web Docs |
| **News** | Google News |

**Other Available Engines** (enable in config):
- **Code:** Bitbucket, Codeberg, Gitea, SourceHut
- **Packages:** RubyGems, Go, Hex, Packagist
- **Social:** Lemmy
- **Video:** YouTube, Vimeo, Bilibili
- **Social:** Mastodon, Lemmy
- **Video:** YouTube, Vimeo, Bilibili
- And many more...

### Q: How is search quality?

**A:** Depends on enabled search engines. Default configuration includes mainstream search engines with good quality. To adjust, edit `searxng/config/settings.yml`.

---

## Contributing

We welcome contributions from the community! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Ways to Contribute

- Improve search engine configurations
- Add new features to MCP Server
- Report bugs and issues
- Suggest new features
- Improve documentation
- Share your feedback

---

## Resources

### 📚 Documentation
- [Installation Guide](INSTALL.md) - Detailed installation instructions
- [SearXNG Documentation](https://docs.searxng.org/) - Official SearXNG docs
- [MCP Specification](https://modelcontextprotocol.io/) - Model Context Protocol

### 🌐 Official Website
- [Wuxing Codes Blog](https://blog.wuxingcodes.com/) - Latest updates and tutorials

### 💬 Community
- [GitHub Issues](https://github.com/MaesHughes/wuxing-search-mcp/issues) - Report bugs
- [GitHub Discussions](https://github.com/MaesHughes/wuxing-search-mcp/discussions) - Ask questions

---

## License

[MIT License](LICENSE) - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built on top of [SearXNG](https://searxng.org/) - An open-source metasearch engine
- Built for the [Claude Code](https://claude.ai/code) community
- Part of the [Wuxing Codes](https://blog.wuxingcodes.com/) ecosystem

---

<div align="center">

**Made with ❤️ by the Wuxing team**

**⭐ Star us on GitHub — it helps!**

</div>
