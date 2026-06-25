#!/bin/bash
# package —— 打包模版源码压缩包（供上传）。
# 保留：运行源码、server.mjs、配置、.agents/、docs/、package*.json。
# 剔除：依赖、本地状态、密钥(.env)、日志、本地构建产物。
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-template-source.zip}"
rm -f "$OUT"

zip -rq "$OUT" . \
  -x 'node_modules/*' \
  -x 'coverage/*' \
  -x 'dist/*' \
  -x 'runtime/*' \
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
echo "   保留 src/ public/ .agents/ docs/ + 配置/server.mjs/package*.json；含 .env.example（无密钥）"
echo "   剔除 node_modules/ dist/ runtime/ .env/ 及本地状态/临时产物"
