#!/usr/bin/env bash
# ============================================================
# GridTrax 一键部署脚本
# 用法:
#   ./deploy.sh              # HTTP 模式 (默认)
#   ./deploy.sh --ssl        # HTTPS 模式
#   ./deploy.sh --port 8080  # 自定义端口
# ============================================================

set -euo pipefail

# ---------- 默认值 ----------
SSL=false
PORT=721
ENV_FILE=".env.local"

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[GridTrax]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✔${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }
err()  { echo -e "${RED}  ✖${NC} $*" >&2; }

# ---------- 解析参数 ----------
while [[ $# -gt 0 ]]; do
  case $1 in
    --ssl)  SSL=true; shift ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help)
      echo "用法: $0 [--ssl] [--port <端口>]"
      echo "  --ssl         启用 HTTPS 模式 (需要 Let's Encrypt 证书)"
      echo "  --port <端口>  自定义主机端口 (默认: 721)"
      exit 0 ;;
    *) err "未知参数: $1"; exit 1 ;;
  esac
done

# ---------- 检查依赖 ----------
for cmd in docker; do
  if ! command -v "$cmd" &>/dev/null; then
    err "未找到 $cmd，请先安装。"
    exit 1
  fi
done

# ---------- 读取 TMDB Token ----------
if [[ -f "$ENV_FILE" ]]; then
  VITE_TMDB_BEARER=$(grep -oP '(?<=VITE_TMDB_BEARER=).*' "$ENV_FILE" || true)
fi

if [[ -z "${VITE_TMDB_BEARER:-}" ]]; then
  err "未找到 VITE_TMDB_BEARER。请在 .env.local 中配置。"
  exit 1
fi

export VITE_TMDB_BEARER
export GRIDTRAX_PORT="$PORT"

# ---------- 部署 ----------
log "开始 GridTrax 部署..."
log "模式: $(if $SSL; then echo 'HTTPS (SSL)'; else echo 'HTTP'; fi)"
log "端口: $PORT"

if $SSL; then
  COMPOSE_PROFILES=ssl docker compose up -d --build
else
  docker compose up -d --build
fi

ok "部署完成！"

if $SSL; then
  ok "访问地址: https://localhost:$PORT (请将 localhost 替换为您的实际域名/IP)"
else
  ok "访问地址: http://localhost:$PORT"
fi

log "查看日志: docker compose logs -f"
