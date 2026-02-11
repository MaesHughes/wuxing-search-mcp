################################################################################
# Wuxing Search MCP - 一键安装脚本 (Windows)
# 用法：.\install.ps1
################################################################################

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色函数
function Print-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

function Print-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host "$Message" -ForegroundColor Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host ""
}

# 检查 Docker
function Test-Docker {
    Print-Header "步骤 1/5：检查 Docker 环境"

    try {
        $dockerVersion = docker --version
        Print-Success "Docker 已安装: $dockerVersion"

        # 检查 Docker 是否运行
        $null = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Success "Docker 服务正在运行"
        } else {
            Print-Error "Docker 服务未运行"
            Print-Info "请启动 Docker Desktop"
            exit 1
        }
    } catch {
        Print-Error "Docker 未安装"
        Print-Info "请先安装 Docker Desktop:"
        Print-Info "  https://docs.docker.com/desktop/install/windows-install/"
        exit 1
    }

    Write-Host ""
}

# 安装 npm 依赖
function Install-NpmDependencies {
    Print-Header "步骤 2/5：安装 MCP Server 依赖"

    try {
        $npmVersion = npm --version
        Print-Success "npm 已安装: $npmVersion"
        Print-Info "正在安装依赖..."

        npm install
        if ($LASTEXITCODE -eq 0) {
            Print-Success "依赖安装成功"
        } else {
            Print-Error "依赖安装失败"
            exit 1
        }
    } catch {
        Print-Error "npm 未安装"
        Print-Info "请先安装 Node.js: https://nodejs.org/"
        exit 1
    }

    Write-Host ""
}

# 停止旧容器
function Stop-OldContainer {
    Print-Header "步骤 3/5：清理旧容器"

    try {
        $existingContainer = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^wuxing-searxng$"
        if ($existingContainer) {
            Print-Info "发现旧容器，正在停止..."
            docker stop wuxing-searxng 2>$null | Out-Null
            docker rm wuxing-searxng 2>$null | Out-Null
            Print-Success "旧容器已清理"
        } else {
            Print-Info "未发现旧容器，跳过"
        }
    } catch {
        Print-Info "清理旧容器时出错，继续安装..."
    }

    Write-Host ""
}

# 启动 SearXNG
function Start-SearXNG {
    Print-Header "步骤 4/5：启动 SearXNG 搜索引擎"

    Print-Info "正在拉取 SearXNG 镜像..."
    docker pull searxng/searxng:latest 2>$null | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Print-Success "镜像拉取成功"
    } else {
        Print-Error "镜像拉取失败"
        exit 1
    }

    Print-Info "正在启动 SearXNG 容器..."

    # 获取当前脚本所在目录
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ConfigDir = Join-Path $ScriptDir "searxng\config"
    $DataDir = Join-Path $ScriptDir "searxng\data"

    # 创建目录（如果不存在）
    if (-not (Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }
    if (-not (Test-Path $DataDir)) {
        New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    }

    # 转换路径为 Windows 风格
    $ConfigDirWin = $ConfigDir.Replace('\', '/')
    $DataDirWin = $DataDir.Replace('\', '/')

    # 启动容器
    $dockerRunCmd = @"
docker run -d `
    --name wuxing-searxng `
    --restart unless-stopped `
    -p 18080:8080 `
    -v "${ConfigDirWin}:/etc/searxng/" `
    -v "${DataDirWin}:/var/cache/searxng/" `
    searxng/searxng:latest
"@

    Invoke-Expression $dockerRunCmd 2>$null | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Print-Success "SearXNG 容器启动成功"
    } else {
        Print-Error "SearXNG 容器启动失败"
        exit 1
    }

    # 等待服务启动
    Print-Info "等待 SearXNG 服务启动..."
    Start-Sleep -Seconds 5

    # 测试服务
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:18080" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Print-Success "SearXNG 服务运行正常 (http://localhost:18080)"
    } catch {
        Print-Warning "SearXNG 服务可能需要更多时间启动"
        Print-Info "请稍后手动测试: curl http://localhost:18080"
    }

    Write-Host ""
}

# 生成配置指南
function Show-ConfigGuide {
    Print-Header "步骤 5/5：生成 Claude Code 配置"

    # 获取当前脚本所在目录
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $McpServerPath = Join-Path $ScriptDir "src\index.js"

    # Windows 配置文件路径
    $ConfigDir = "$env:APPDATA\Claude"
    $ConfigFile = Join-Path $ConfigDir "claude_desktop_config.json"

    Write-Host ""
    Print-Info "请将以下配置添加到 Claude Code 配置文件中："
    Write-Host ""
    Write-Host "配置文件路径: $ConfigFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "配置内容:" -ForegroundColor Green
    Write-Host ""
    Write-Host @"
{
  "mcpServers": {
    "wuxing-search": {
      "command": "node",
      "args": ["$McpServerPath"],
      "env": {
        "SEARXNG_URL": "http://localhost:18080"
      }
    }
  }
}
"@ -ForegroundColor White

    Write-Host ""
    Print-Info "配置步骤："
    Write-Host "  1. 打开 Claude Code"
    Write-Host "  2. 按 Ctrl + Shift + P 打开命令面板"
    Write-Host "  3. 输入并选择: MCP: Open User Configuration"
    Write-Host "  4. 粘贴上面的配置内容"
    Write-Host "  5. 保存文件（Ctrl+S）"
    Write-Host "  6. 重启 Claude Code"

    Write-Host ""
}

# 打印管理命令
function Show-ManagementCommands {
    Print-Header "管理命令"

    Write-Host @"
常用管理命令:

查看 SearXNG 状态:
  docker ps | Select-String wuxing-searxng

查看 SearXNG 日志:
  docker logs -f wuxing-searxng

重启 SearXNG:
  docker restart wuxing-searxng

停止 SearXNG:
  docker stop wuxing-searxng

启动 SearXNG:
  docker start wuxing-searxng

测试搜索服务:
  curl http://localhost:18080/search?q=test&format=json

"@ -ForegroundColor White
}

# 主函数
function Main {
    Print-Header "🚀 Wuxing Search MCP 一键安装"

    Write-Host ""
    Print-Info "此脚本将自动完成以下操作："
    Write-Host "  1. 检查 Docker 环境"
    Write-Host "  2. 安装 MCP Server 依赖"
    Write-Host "  3. 清理旧容器（如果存在）"
    Write-Host "  4. 启动 SearXNG 搜索引擎"
    Write-Host "  5. 生成 Claude Code 配置指南"
    Write-Host ""
    Print-Warning "按 Ctrl+C 取消安装"
    Write-Host ""

    # 等待 3 秒
    Start-Sleep -Seconds 3

    # 执行安装步骤
    Test-Docker
    Install-NpmDependencies
    Stop-OldContainer
    Start-SearXNG
    Show-ConfigGuide
    Show-ManagementCommands

    # 完成
    Print-Header "🎉 安装完成！"

    Print-Success "所有组件已成功安装并启动"
    Write-Host ""
    Print-Info "下一步："
    Write-Host "  1. 按照上面的指南配置 Claude Code"
    Write-Host "  2. 重启 Claude Code"
    Write-Host "  3. 开始使用搜索功能！"
    Write-Host ""

    Print-Info "如遇问题，请查看项目 README.md"
    Write-Host ""
}

# 运行主函数
Main
