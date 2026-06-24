#!/bin/bash
# package —— 打包模版源码压缩包（供上传）。
# 保留：运行源码、生产构建产物 dist/、server.mjs、配置、.agents/、docs/、package*.json。
# 剔除：依赖、本地状态、密钥(.env)、日志、临时产物。
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-template-source.zip}"
rm -f "$OUT"

echo "[package] building production artifacts"
npm run build

if [ ! -f "dist/server/server.js" ]; then
  echo "[package] missing runtime entry: dist/server/server.js" >&2
  exit 1
fi

zip -rq "$OUT" . \
  -x 'node_modules/*' \
  -x 'coverage/*' \
  -x 'test-results/*' \
  -x 'playwright-report/*' \
  -x '.playwright-artifacts/*' \
  -x '.tanstack/*' \
  -x '.git/*' \
  -x '.codegraph/*' \
  -x '.remember/*' \
  -x '.superpowers/*' \
  -x '.claude/*' \
  -x '.env' \
  -x '*.log' \
  -x 'tsconfig.tsbuildinfo' \
  -x '1.json' -x '2.json' \
  -x '*.zip' \
  -x '.DS_Store' -x '*/.DS_Store'

echo "✅ 打包完成: $OUT ($(du -h "$OUT" | cut -f1))"
echo "   保留 src/ public/ dist/ .agents/ docs/ + 配置/server.mjs/package*.json；含 .env.example（无密钥）"
echo "   剔除 node_modules/ .env/ 及本地状态/临时产物"
