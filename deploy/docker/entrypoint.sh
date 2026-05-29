#!/bin/sh
# ============================================================
# GridTrax Docker Entrypoint
# ============================================================

set -e

# 目标目录（Nginx 静态资源目录）
ASSETS_DIR="/usr/share/nginx/html/assets"
ENV_FILE="/app/.env.local"

# 1. 尝试从挂载的 .env.local 读取 (如果环境变量未设置)
# 使用 grep 提取 VITE_TMDB_BEARER 的值
if [ -z "$VITE_TMDB_BEARER" ] && [ -f "$ENV_FILE" ]; then
  # 兼容 VITE_TMDB_BEARER=xxx 或 VITE_TMDB_BEARER="xxx" 格式
  FILE_VAL=$(grep -E "^VITE_TMDB_BEARER=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' | tr -d ' ' || true)
  if [ -n "$FILE_VAL" ]; then
    export VITE_TMDB_BEARER="$FILE_VAL"
  fi
fi

# 2. 检查最终环境变量
REAL_TMDB_BEARER="${VITE_TMDB_BEARER:-}"

log() {
  echo "[GridTrax Entrypoint] $*"
}

if [ -n "$REAL_TMDB_BEARER" ]; then
  log "检测到 VITE_TMDB_BEARER 环境变量，正在注入到静态资源..."
  # 查找所有 js 文件并替换占位符
  # 注意：由于 JS 混淆，占位符两侧可能有引号，sed 会原样处理。
  find "$ASSETS_DIR" -name "*.js" -exec sed -i "s|PLACEHOLDER_TMDB_BEARER|${REAL_TMDB_BEARER}|g" {} +
  log "注入完成。"
else
  log "未检测到 VITE_TMDB_BEARER，将使用默认值（或网页端设置）。"
  find "$ASSETS_DIR" -name "*.js" -exec sed -i "s|PLACEHOLDER_TMDB_BEARER||g" {} +
fi

# 执行 CMD (nginx)
exec "$@"
