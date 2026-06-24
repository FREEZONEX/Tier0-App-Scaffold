#!/bin/bash
# dev:demo —— 预览 RX-100 示例图（HMI_SEED_DEMO=1）。
# 数据源沿用 .env 里的环境变量（真实 Tier0 broker / UNS），不强制 mock。
#
# 注意：seed 只在 mimics 表为空时执行，所以先清表，让示例图重新 seed。
set -uo pipefail
cd "$(dirname "$0")/.."

# 注意 --env-file=.env：清表脚本要从 .env 拿 DATABASE_URL，否则连不上库、清表静默失败 → 空表残留 → demo 仍空。
node --env-file=.env --import tsx -e "import {db} from './src/db/index.ts'; import {sql} from 'drizzle-orm'; await db.execute(sql\`delete from mimics\`); console.log('[dev:demo] mimics 表已清，将重新 seed 示例图'); process.exit(0);" 2>/dev/null \
  || echo "[dev:demo] 清表跳过（DB 未起 / .env 无 DATABASE_URL）——首次访问首页会按 HMI_SEED_DEMO seed 示例图"

HMI_SEED_DEMO=1 \
PREVIEW_USER_ID=dev-admin PREVIEW_USER_NAME="Dev Admin" PREVIEW_USER_ROLE=admin \
SESSION_SECRET=dev-secret-0123456789abcdef0123456789abcdef \
  vite dev --host 0.0.0.0 --port 5173
