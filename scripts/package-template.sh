#!/bin/bash
# package —— 打包模版源码压缩包（供上传）。
# 保留：运行源码（src/ public/ server.mjs + 全部配置）、.agents/、docs/、文档、package*.json。
# 剔除：依赖与构建产物（node_modules/ dist/ coverage/ ...）、本地状态、密钥(.env)、日志、版本库。
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-template-source.zip}"
rm -f "$OUT"

zip -rq "$OUT" . \
  -x 'node_modules/*' \
  -x 'dist/*' \
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
echo "   保留 src/ public/ .agents/ docs/ + 配置/server.mjs/package*.json；含 .env.example（无密钥）"
echo "   剔除 node_modules/ dist/ .env/ 及本地状态/构建产物"
