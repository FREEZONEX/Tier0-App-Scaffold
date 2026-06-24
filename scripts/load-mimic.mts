import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { parseMimic } from "../src/hmi/schema/schema";

/**
 * 把一份 mimic schema JSON 直接 UPSERT 进 DB 的 default 图行。
 *
 *   tsx scripts/load-mimic.mts <schema.json>
 *
 * 这是「AI 生成客户图 → 进数据库」的唯一通道：不写任何 json 源文件、不靠 seed。
 * 编辑/预览模式读 DB 的 default 行，跑完本脚本刷新 dev:preview 即见。
 * 演示样板 demo-mimic.json 与此无关，永远独立只读。
 */
const file = process.argv[2];
if (!file) {
  console.error("用法: tsx scripts/load-mimic.mts <schema.json>");
  process.exit(1);
}

const r = parseMimic(JSON.parse(readFileSync(file, "utf8")));
if (!r.ok) {
  console.error("schema 校验失败：", JSON.stringify(r.error, null, 2));
  process.exit(1);
}
const mimic = r.data!;

const dbSchema = process.env.DB_SCHEMA;
const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  max: 5,
  ...(dbSchema ? { options: `-csearch_path=${dbSchema}` } : {}),
});

async function main(): Promise<void> {
  // 表可能尚未建（首次未跑过 dev:preview 的 bootstrap）→ 与 services/mimics.ts 一致地幂等建表
  await pool.query(`
    create table if not exists mimics (
      id text primary key,
      name text not null,
      data jsonb not null,
      tenant text,
      owner text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
  const data = JSON.stringify(mimic);
  const found = await pool.query("select id from mimics where name = 'default' limit 1");
  if (found.rows.length > 0) {
    const id = found.rows[0].id as string;
    await pool.query("update mimics set data = $1::jsonb, updated_at = now() where id = $2", [data, id]);
    console.log(`已更新 default 图（${id}），节点数 ${mimic.nodes.length}`);
  } else {
    await pool.query("insert into mimics (id, name, data) values ($1, 'default', $2::jsonb)", [
      crypto.randomUUID(),
      data,
    ]);
    console.log(`已插入 default 图，节点数 ${mimic.nodes.length}`);
  }
}

main()
  .catch((e) => {
    console.error("load-mimic 失败：", e);
    process.exit(1);
  })
  .finally(() => pool.end());
