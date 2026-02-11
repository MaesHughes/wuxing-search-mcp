#!/bin/bash

################################################################################
# Wuxing Search MCP - 一键安装脚本 (Linux/Mac)
# 用法：bash install.sh
################################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Docker
check_docker() {
    print_header "步骤 1/5：检查 Docker 环境"

    if command_exists docker; then
        print_success "Docker 已安装"

        # 检查 Docker 是否运行
        if docker info >/dev/null 2>&1; then
            print_success "Docker 服务正在运行"
        else
            print_error "Docker 服务未运行"
            print_info "请启动 Docker Desktop 或运行: sudo systemctl start docker"
            exit 1
        fi
    else
        print_error "Docker 未安装"
        print_info "请先安装 Docker："
        print_info "  Mac:   https://docs.docker.com/desktop/install/mac-install/"
        print_info "  Linux: https://docs.docker.com/engine/install/"
        exit 1
    fi

    echo ""
}

# 安装 npm 依赖
install_npm_dependencies() {
    print_header "步骤 2/5：安装 MCP Server 依赖"

    if command_exists npm; then
        print_success "npm 已安装"
        print_info "正在安装依赖..."

        if npm install; then
            print_success "依赖安装成功"
        else
            print_error "依赖安装失败"
            exit 1
        fi
    else
        print_error "npm 未安装"
        print_info "请先安装 Node.js: https://nodejs.org/"
        exit 1
    fi

    echo ""
}

# 停止旧容器
stop_old_container() {
    print_header "步骤 3/5：清理旧容器"

    if docker ps -a --format '{{.Names}}' | grep -q "^wuxing-searxng$"; then
        print_info "发现旧容器，正在停止..."
        docker stop wuxing-searxng >/dev/null 2>&1 || true
        docker rm wuxing-searxng >/dev/null 2>&1 || true
        print_success "旧容器已清理"
    else
        print_info "未发现旧容器，跳过"
    fi

    echo ""
}

# 启动 SearXNG
start_searxng() {
    print_header "步骤 4/5：启动 SearXNG 搜索引擎"

    print_info "正在拉取 SearXNG 镜像..."
    if docker pull searxng/searxng:latest >/dev/null 2>&1; then
        print_success "镜像拉取成功"
    else
        print_error "镜像拉取失败"
        exit 1
    fi

    print_info "正在启动 SearXNG 容器..."

    # 获取当前脚本所在目录的绝对路径
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    CONFIG_DIR="$SCRIPT_DIR/searxng/config"
    DATA_DIR="$SCRIPT_DIR/searxng/data"

    # 创建目录（如果不存在）
    mkdir -p "$CONFIG_DIR" "$DATA_DIR"

    # 启动容器
    if docker run -d \
        --name wuxing-searxng \
        --restart unless-stopped \
        -p 18080:8080 \
        -v "$CONFIG_DIR:/etc/searxng/" \
        -v "$DATA_DIR:/var/cache/searxng/" \
        searxng/searxng:latest >/dev/null 2>&1; then
        print_success "SearXNG 容器启动成功"
    else
        print_error "SearXNG 容器启动失败"
        exit 1
    fi

    # 等待服务启动
    print_info "等待 SearXNG 服务启动..."
    sleep 5

    # 测试服务
    if curl -s http://localhost:18080 >/dev/null 2>&1; then
        print_success "SearXNG 服务运行正常 (http://localhost:18080)"
    else
        print_warning "SearXNG 服务可能需要更多时间启动"
        print_info "请稍后手动测试: curl http://localhost:18080"
    fi

    echo ""
}

# 生成配置指南
generate_config_guide() {
    print_header "步骤 5/5：生成 Claude Code 配置"

    # 获取当前脚本所在目录的绝对路径
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    MCP_SERVER_PATH="$SCRIPT_DIR/src/index.js"

    # 检测操作系统
    OS="$(uname -s)"
    CONFIG_FILE=""

    case "$OS" in
        Darwin*)
            # macOS
            CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
            ;;
        Linux*)
            # Linux
            if [ -n "$XDG_CONFIG_HOME" ]; then
                CONFIG_FILE="$XDG_CONFIG_HOME/Claude/claude_desktop_config.json"
            else
                CONFIG_FILE="$HOME/.config/Claude/claude_desktop_config.json"
            fi
            ;;
        *)
            print_warning "未知操作系统: $OS"
            CONFIG_FILE="$HOME/.config/Claude/claude_desktop_config.json"
            ;;
    esac

    echo ""
    print_info "请将以下配置添加到 Claude Code 配置文件中："
    echo ""
    echo -e "${YELLOW}配置文件路径:${NC} $CONFIG_FILE"
    echo ""
    echo -e "${GREEN}配置内容：${NC}"
    echo ""
    cat <<EOF
{
  "mcpServers": {
    "wuxing-search": {
      "command": "node",
      "args": ["$MCP_SERVER_PATH"],
      "env": {
        "SEARXNG_URL": "http://localhost:18080"
      }
    }
  }
}
EOF

    echo ""
    print_info "配置步骤："
    echo "  1. 打开 Claude Code"
    echo "  2. 按 Cmd/Ctrl + Shift + P 打开命令面板"
    echo "  3. 输入并选择: MCP: Open User Configuration"
    echo "  4. 粘贴上面的配置内容"
    echo "  5. 保存文件"
    echo "  6. 重启 Claude Code"

    echo ""
}

# 打印管理命令
print_management_commands() {
    print_header "管理命令"

    cat <<EOF
${GREEN}常用管理命令:${NC}

${BLUE}查看 SearXNG 状态:${NC}
  docker ps | grep wuxing-searxng

${BLUE}查看 SearXNG 日志:${NC}
  docker logs -f wuxing-searxng

${BLUE}重启 SearXNG:${NC}
  docker restart wuxing-searxng

${BLUE}停止 SearXNG:${NC}
  docker stop wuxing-searxng

${BLUE}启动 SearXNG:${NC}
  docker start wuxing-searxng

${BLUE}测试搜索服务:${NC}
  curl http://localhost:18080/search?q=test&format=json

EOF
}

# 主函数
main() {
    print_header "🚀 Wuxing Search MCP 一键安装"

    echo ""
    print_info "此脚本将自动完成以下操作："
    echo "  1. 检查 Docker 环境"
    echo "  2. 安装 MCP Server 依赖"
    echo "  3. 清理旧容器（如果存在）"
    echo "  4. 启动 SearXNG 搜索引擎"
    echo "  5. 生成 Claude Code 配置指南"
    echo ""
    print_warning "按 Ctrl+C 取消安装"
    echo ""

    # 等待 3 秒
    sleep 3

    # 执行安装步骤
    check_docker
    install_npm_dependencies
    stop_old_container
    start_searxng
    generate_config_guide
    print_management_commands

    # 完成
    print_header "🎉 安装完成！"

    print_success "所有组件已成功安装并启动"
    echo ""
    print_info "下一步："
    echo "  1. 按照上面的指南配置 Claude Code"
    echo "  2. 重启 Claude Code"
    echo "  3. 开始使用搜索功能！"
    echo ""

    print_info "如遇问题，请查看故障排查指南："
    print_info "  https://github.com/your-username/wuxing-search-mcp#troubleshooting"
    echo ""
}

# 运行主函数
main "$@"
