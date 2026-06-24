import { sql, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { mimics, type MimicRow } from "@/db/schema";
import { mimicSchema, type Mimic } from "@/hmi/schema/schema";
import { bootstrapModule } from "./bootstrap";
import defaultMimic from "@/hmi/data/default-mimic.json";

/** 列表元信息：不含大 json data，只够选择器/列表渲染。 */
export interface MimicMeta {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 运行时幂等建表 + 首次 seed。每个公开入口先调它，免手动 db:push。
 * seed 仅在空表时跑（bootstrap 内 hasRows 把关）：插入首条 name="default"。
 * 默认 seed 空白图（default-mimic.json，模板开局空画布）。客户图不走文件/seed：
 * 用 `tsx scripts/load-mimic.mts <schema.json>` 直接 UPSERT 进 DB 的 default 行（见该脚本）。
 * 内嵌 import（非 fs 读 public/）→ 生产 bundle 不依赖 cwd。
 */
export function bootstrapMimics(): Promise<void> {
  return bootstrapModule("hmi", [
    {
      tableName: "mimics",
      createTable: sql`
        create table if not exists mimics (
          id text primary key,
          name text not null,
          data jsonb not null,
          tenant text,
          owner text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`,
      createIndexes: [sql`create index if not exists mimics_name_idx on mimics (name)`],
      seed: async (tx) => {
        const source = defaultMimic;
        const data = mimicSchema.parse(source);
        await tx.execute(sql`
          insert into mimics (id, name, data)
          values (${crypto.randomUUID()}, ${"default"}, ${JSON.stringify(data)}::jsonb)`);
      },
    },
  ]);
}

export async function listMimics(): Promise<MimicMeta[]> {
  await bootstrapMimics();
  return db
    .select({
      id: mimics.id,
      name: mimics.name,
      createdAt: mimics.createdAt,
      updatedAt: mimics.updatedAt,
    })
    .from(mimics)
    .orderBy(asc(mimics.createdAt));
}

export async function getMimic(id: string): Promise<MimicRow | null> {
  await bootstrapMimics();
  const [row] = await db.select().from(mimics).where(eq(mimics.id, id)).limit(1);
  return row ?? null;
}

export async function createMimic(name: string, data: Mimic): Promise<MimicRow> {
  await bootstrapMimics();
  const [row] = await db.insert(mimics).values({ name, data }).returning();
  return row;
}

export async function updateMimic(id: string, data: Mimic): Promise<MimicRow> {
  await bootstrapMimics();
  const [row] = await db.update(mimics).set({ data }).where(eq(mimics.id, id)).returning();
  if (!row) throw new Error(`mimic 不存在: ${id}`);
  return row;
}

export async function renameMimic(id: string, name: string): Promise<MimicRow> {
  await bootstrapMimics();
  const [row] = await db.update(mimics).set({ name }).where(eq(mimics.id, id)).returning();
  if (!row) throw new Error(`mimic 不存在: ${id}`);
  return row;
}

export async function deleteMimic(id: string): Promise<void> {
  await bootstrapMimics();
  await db.delete(mimics).where(eq(mimics.id, id));
}
