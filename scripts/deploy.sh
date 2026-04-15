#!/bin/bash
# 部署脚本 — portfolioai
# 用法: bash scripts/deploy.sh [--env .env.prod]
set -e

APP_NAME="portfolioai"
PORT=3000
ENV_FILE=".env.prod"
ZIP_TMP="/tmp/${APP_NAME}.zip"
BUILD_API="https://build.pdf2app.cn/api/build"

# 解析参数
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --env) ENV_FILE="$2"; shift ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
  shift
done

# 检查环境变量文件
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到环境变量文件: $ENV_FILE"
  exit 1
fi

# 加载环境变量
set -a
source "$ENV_FILE"
set +a

echo "📦 打包项目..."
zip -q -r "$ZIP_TMP" . \
  --exclude "node_modules/*" \
  --exclude ".git/*" \
  --exclude "data/*" \
  --exclude "sites-data/*" \
  --exclude ".next/*" \
  --exclude ".env*" \
  --exclude "*.log"
echo "   $(du -sh $ZIP_TMP | cut -f1) → $ZIP_TMP"

echo "🚀 上传并部署到 ${APP_NAME}..."
RESPONSE=$(curl -s -X POST "$BUILD_API" \
  -F "file=@${ZIP_TMP}" \
  -F "appName=${APP_NAME}" \
  -F "port=${PORT}" \
  -F "description=AI-powered portfolio site generator" \
  -F "envs={\"AUTH_SECRET\":\"${NEXTAUTH_SECRET}\",\"NEXTAUTH_SECRET\":\"${NEXTAUTH_SECRET}\",\"NEXTAUTH_URL\":\"${NEXTAUTH_URL}\",\"OPENROUTER_API_KEY\":\"${OPENROUTER_API_KEY}\",\"OPENROUTER_BASE_URL\":\"${OPENROUTER_BASE_URL}\",\"OPENROUTER_MODEL\":\"${OPENROUTER_MODEL}\",\"OPENROUTER_WIRE_API\":\"${OPENROUTER_WIRE_API}\",\"LLM_PROVIDER_CHAIN\":\"${LLM_PROVIDER_CHAIN}\",\"PREVIEW_BASE_URL\":\"${PREVIEW_BASE_URL}\",\"BUILD_INLINE_JOBS\":\"${BUILD_INLINE_JOBS}\",\"BUILD_WORKER_POLL_MS\":\"${BUILD_WORKER_POLL_MS}\",\"BUILD_MAX_CONCURRENCY\":\"${BUILD_MAX_CONCURRENCY}\",\"PDF_PARSE_URL\":\"${PDF_PARSE_URL}\"}")

DEPLOY_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('deployId',''))" 2>/dev/null)
LOGS_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('logsUrl',''))" 2>/dev/null)
APP_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('appUrl',''))" 2>/dev/null)

if [ -z "$DEPLOY_ID" ]; then
  echo "❌ 部署失败: $RESPONSE"
  exit 1
fi

echo "   deployId=$DEPLOY_ID"
echo "⏳ 等待构建完成..."

# 轮询日志
while true; do
  sleep 10
  POLL=$(curl -s "$LOGS_URL")
  STATUS=$(echo "$POLL" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
  if [ "$STATUS" = "success" ]; then
    echo "✅ 部署成功！"
    echo "🌐 访问地址: $APP_URL"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ 部署失败，最近日志:"
    echo "$POLL" | python3 -c "import sys,json; print(json.load(sys.stdin)['log'][-2000:])"
    exit 1
  else
    echo -n "."
  fi
done
