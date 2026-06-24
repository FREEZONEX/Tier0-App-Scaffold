# HMI Schema 持久化切库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 HMI schema 持久化从写 `public/schemas/default.json` 改为 Postgres 多图存储，支持多张图命名、列表、切换、CRUD。

**Architecture:** 单向分层——`db/schema.ts`（表）→ `services/mimics.ts`（Repository，唯一碰 db）→ `hmi/data/mimic-store.ts`（server fn 薄包装 + zod 校验）→ `routes/index.tsx`（loader 服务端取数）→ HmiPage / 图纸选择器。本地 docker 起 pg，纯库存储无文件 fallback，`default.json` 降级为 seed 种子。

**Tech Stack:** Drizzle ORM + node-postgres、TanStack Start（`createServerFn` / route loader）、zod、node:test、Playwright、docker compose。

**Spec:** `docs/superpowers/specs/2026-06-08-hmi-db-persistence-design.md`

---

## 关键参考（执行前先读）

- **现有 server fn 模式** `src/hmi/data/save-schema.ts`：`createServerFn({ method: "POST" }).inputValidator((data) => schema.parse(data)).handler(async ({ data }) => {...})`。调用方传 `fn({ data })`。
- **运行时建表** `src/services/bootstrap.ts`：`bootstrapModule(moduleName, tables[])`，每个 table 是 `{ tableName, createTable: SQL, createIndexes?: SQL[], seed?: (tx) => Promise<void> }`；`createTable` 须幂等（`create table if not exists`）；`seed` 仅在空表时跑。
- **db 客户端** `src/db/index.ts`：导出 `db`（drizzle 实例），连接串取 `DATABASE_URL || DIRECT_DATABASE_URL`。
- **Mimic 类型** `src/hmi/schema/schema.ts`：`mimicSchema`（`meta:{name,version}`, `nodes[]`, `edges[]`, `interlocks[]`）、`type Mimic`。空白图 = `mimicSchema.parse({ meta: { name }, nodes: [] })`（edges/interlocks/version 有默认）。
- **测试风格** node:test：`import assert from "node:assert/strict"; import { describe, it } from "node:test";`。运行单文件：`node --import tsx --test src/services/mimics.test.ts`。
- **现有 loader 样例** `src/routes/login.tsx`；loader/server fn 在 SSR + client 导航都会跑，**loader 必须调 `createServerFn` 包装的函数**（不能直接 import `services/*`，否则 pg 进 client bundle）。

---

## File Structure

- **Create** `docker-compose.yml` — 本地 postgres 服务
- **Create** `.env` — `DATABASE_URL`（已 gitignore）
- **Modify** `src/db/schema.ts` — 新增 `mimics` 表 + 派生类型
- **Create** `src/services/mimics.ts` — Repository：bootstrap + seed + CRUD（唯一碰 db）
- **Create** `src/services/mimics.test.ts` — 集成测试（无 DATABASE_URL 则 skip）
- **Create** `src/hmi/data/mimic-store.ts` — server fn 一组 + `MimicRecord`/`MimicMeta` 类型
- **Delete** `src/hmi/data/save-schema.ts` — 旧写文件 server fn
- **Modify** `src/routes/index.tsx` — 客户端 fetch → route loader
- **Modify** `src/hmi/components/HmiPage.tsx` — prop `initialSchema` → `initialMimic`，`saveSchema` → `saveMimic`
- **阶段 2**：
  - **Create** `src/hmi/components/MimicSwitcher.tsx` — 图纸选择器（列表/切换/新建/重命名/删除）
  - **Modify** `src/routes/index.tsx` — `?mimic=<id>` search param 驱动当前图
  - **Modify** `src/hmi/i18n/dict.ts` — 新 UI 字符串
  - **Modify** `e2e/hmi.spec.ts` — 多图流程

---

# 阶段 1：持久化层切库

## Task 0: docker pg + .env

**Files:**
- Create: `docker-compose.yml`
- Create: `.env`

- [ ] **Step 1: 写 docker-compose.yml**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: hmi-pg
    environment:
      POSTGRES_USER: hmi
      POSTGRES_PASSWORD: hmi
      POSTGRES_DB: hmi
    ports:
      - "5433:5432"
    volumes:
      - hmi-pg-data:/var/lib/postgresql/data
volumes:
  hmi-pg-data:
```

- [ ] **Step 2: 起库**

Run: `docker compose up -d`
Expected: `Container hmi-pg  Started`

- [ ] **Step 3: 写 .env**

```
DATABASE_URL=postgresql://hmi:hmi@localhost:5433/hmi
```

- [ ] **Step 4: 验证连接**

Run: `docker exec hmi-pg pg_isready -U hmi`
Expected: `/var/run/postgresql:5432 - accepting connections`

- [ ] **Step 5: Commit（不含 .env）**

```bash
git add docker-compose.yml
git commit -m "chore(hmi): 本地 docker postgres 用于 schema 持久化"
```

---

## Task 1: mimics 表定义

**Files:**
- Modify: `src/db/schema.ts`

> 纯声明，无独立测试；用 `tsc` 验证。

- [ ] **Step 1: 替换 schema.ts 的注释模板为 mimics 表**

把文件改成（保留顶部 eslint-disable 块可删，因为表已用到 import）：

```ts
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { Mimic } from "@/hmi/schema/schema";

export const mimics = pgTable("mimics", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:      text("name").notNull(),
  data:      jsonb("data").$type<Mimic>().notNull(),
  tenant:    text("tenant"),
  owner:     text("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const insertMimicSchema = createInsertSchema(mimics);
export const selectMimicSchema = createSelectSchema(mimics);
export type MimicRow    = typeof mimics.$inferSelect;
export type NewMimicRow = typeof mimics.$inferInsert;
```

- [ ] **Step 2: 验证类型**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(hmi): mimics 表定义（jsonb data + nullable tenant/owner）"
```

---

## Task 2: Repository — bootstrap + seed

**Files:**
- Create: `src/services/mimics.ts`
- Create: `src/services/mimics.test.ts`

- [ ] **Step 1: 写失败测试 mimics.test.ts**

```ts
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mimics } from "@/db/schema";
import { bootstrapMimics, listMimics } from "./mimics";

const HAS_DB = !!(process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL);

describe("mimics repository — bootstrap/seed", { skip: HAS_DB ? false : "no DATABASE_URL" }, () => {
  it("bootstrap 后 default 图存在（从 default.json 迁移）", async () => {
    await bootstrapMimics();
    const list = await listMimics();
    assert.ok(list.some((m) => m.name === "default"), "应有 name=default 的种子图");
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --import tsx --test src/services/mimics.test.ts`
Expected: FAIL（`bootstrapMimics` 未定义 / 模块不存在）

- [ ] **Step 3: 实现 bootstrap + seed + listMimics（最小通过）**

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql, eq, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { mimics, type MimicRow } from "@/db/schema";
import { mimicSchema, type Mimic } from "@/hmi/schema/schema";
import { bootstrapModule } from "./bootstrap";

export interface MimicMeta {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

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
        const raw = await readFile(
          join(process.cwd(), "public", "schemas", "default.json"),
          "utf-8",
        );
        const data = mimicSchema.parse(JSON.parse(raw));
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
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --import tsx --test src/services/mimics.test.ts`
Expected: PASS（或在无库环境 skip）

- [ ] **Step 5: Commit**

```bash
git add src/services/mimics.ts src/services/mimics.test.ts
git commit -m "feat(hmi): mimics repository bootstrap + seed（迁移 default.json）"
```

---

## Task 3: Repository — getMimic + CRUD

**Files:**
- Modify: `src/services/mimics.ts`
- Modify: `src/services/mimics.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `mimics.test.ts` 追加（顶部补 import：`getMimic, createMimic, updateMimic, renameMimic, deleteMimic`）：

```ts
describe("mimics repository — CRUD", { skip: HAS_DB ? false : "no DATABASE_URL" }, () => {
  const made: string[] = [];
  after(async () => {
    if (!HAS_DB) return;
    for (const id of made) await deleteMimic(id);
  });
  const blank = (name: string): Mimic =>
    mimicSchema.parse({ meta: { name }, nodes: [] });

  it("create → get round-trip", async () => {
    const row = await createMimic("t-create", blank("t-create"));
    made.push(row.id);
    const got = await getMimic(row.id);
    assert.equal(got?.name, "t-create");
    assert.equal(got?.data.meta.name, "t-create");
  });

  it("update 改 data 并刷新 updatedAt", async () => {
    const row = await createMimic("t-update", blank("t-update"));
    made.push(row.id);
    const next = mimicSchema.parse({ meta: { name: "t-update" }, nodes: [{ id: "n1", type: "pump", x: 0, y: 0 }] });
    const updated = await updateMimic(row.id, next);
    assert.equal(updated.data.nodes.length, 1);
  });

  it("rename 改 name 不动 data", async () => {
    const row = await createMimic("t-rename", blank("t-rename"));
    made.push(row.id);
    const r = await renameMimic(row.id, "t-rename-2");
    assert.equal(r.name, "t-rename-2");
    assert.equal(r.data.meta.name, "t-rename");
  });

  it("delete 后 get 返回 null", async () => {
    const row = await createMimic("t-del", blank("t-del"));
    const r = await deleteMimic(row.id);
    assert.equal(await getMimic(row.id), null);
  });

  it("list 只返元信息不带 data", async () => {
    const list = await listMimics();
    assert.ok(list.length > 0);
    assert.equal((list[0] as Record<string, unknown>).data, undefined);
  });
});
```

需要 `import type { Mimic } from "@/hmi/schema/schema";` 在测试顶部。

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --import tsx --test src/services/mimics.test.ts`
Expected: FAIL（`getMimic` 等未定义）

- [ ] **Step 3: 实现 CRUD**

在 `mimics.ts` 追加：

```ts
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
  const [row] = await db
    .update(mimics)
    .set({ data })
    .where(eq(mimics.id, id))
    .returning();
  if (!row) throw new Error(`mimic 不存在: ${id}`);
  return row;
}

export async function renameMimic(id: string, name: string): Promise<MimicRow> {
  await bootstrapMimics();
  const [row] = await db
    .update(mimics)
    .set({ name })
    .where(eq(mimics.id, id))
    .returning();
  if (!row) throw new Error(`mimic 不存在: ${id}`);
  return row;
}

export async function deleteMimic(id: string): Promise<void> {
  await bootstrapMimics();
  await db.delete(mimics).where(eq(mimics.id, id));
}
```

清理未用 import（`desc` 若没用到删掉）。

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --import tsx --test src/services/mimics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/mimics.ts src/services/mimics.test.ts
git commit -m "feat(hmi): mimics repository CRUD（get/create/update/rename/delete）"
```

---

## Task 4: server fn 层 mimic-store.ts

**Files:**
- Create: `src/hmi/data/mimic-store.ts`

> server fn 是薄包装，底层 service 已测；用 `tsc` 验证签名。

- [ ] **Step 1: 写 mimic-store.ts**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mimicSchema, type Mimic } from "@/hmi/schema/schema";
import {
  listMimics,
  getMimic,
  createMimic,
  updateMimic,
  renameMimic,
  deleteMimic,
} from "@/services/mimics";

/** 前端用的纯对象记录（不耦合 db 层类型，Date 已转 ISO 字符串）。 */
export interface MimicRecord {
  id: string;
  name: string;
  data: Mimic;
  createdAt: string;
  updatedAt: string;
}

/** 选择器列表项：前端只需 id/name（不暴露时间，避免 Date→string 序列化类型谎言）。 */
export interface MimicListItem {
  id: string;
  name: string;
}

const toRecord = (row: { id: string; name: string; data: Mimic; createdAt: Date; updatedAt: Date }): MimicRecord => ({
  id: row.id,
  name: row.name,
  data: row.data,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listMimicsFn = createServerFn().handler(
  async (): Promise<MimicListItem[]> => (await listMimics()).map((m) => ({ id: m.id, name: m.name })),
);

/** 取默认图：优先 name=default，否则最早一条。无图则用空白图兜底（不应发生，seed 保证有 default）。 */
export const loadDefaultMimicFn = createServerFn().handler(async (): Promise<MimicRecord> => {
  const list = await listMimics();
  const pick = list.find((m) => m.name === "default") ?? list[0];
  if (!pick) {
    const data = mimicSchema.parse({ meta: { name: "default" }, nodes: [] });
    const row = await createMimic("default", data);
    return toRecord(row);
  }
  const row = await getMimic(pick.id);
  if (!row) throw new Error("默认图加载失败");
  return toRecord(row);
});

export const loadMimicFn = createServerFn()
  .inputValidator((input: { id: string }) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<MimicRecord> => {
    const row = await getMimic(data.id);
    if (!row) throw new Error(`图纸不存在: ${data.id}`);
    return toRecord(row);
  });

export const saveMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; data: Mimic }) =>
    z.object({ id: z.string().min(1), data: mimicSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<MimicRecord> => toRecord(await updateMimic(data.id, data.data)));

export const createMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => z.object({ name: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data }): Promise<MimicRecord> => {
    const blank = mimicSchema.parse({ meta: { name: data.name }, nodes: [] });
    return toRecord(await createMimic(data.name, blank));
  });

export const renameMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; name: string }) =>
    z.object({ id: z.string().min(1), name: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<MimicRecord> => toRecord(await renameMimic(data.id, data.name)));

export const deleteMimicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await deleteMimic(data.id);
    return { ok: true };
  });
```

- [ ] **Step 2: 验证类型**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/hmi/data/mimic-store.ts
git commit -m "feat(hmi): mimic-store server fn（list/load/save/create/rename/delete）"
```

---

## Task 5: 加载路径切 loader + HmiPage 接 saveMimic

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/hmi/components/HmiPage.tsx`
- Delete: `src/hmi/data/save-schema.ts`

- [ ] **Step 1: 改 routes/index.tsx 用 loader**

替换 `HmiRoute` 的客户端 fetch 为 loader（保留 `beforeLoad` 取 user 不变）：

```tsx
import { createFileRoute, redirect, type ErrorComponentProps } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { HmiPage } from "@/hmi/components/HmiPage";
import { getCurrentUser } from "@/lib/auth";
import type { AppUser } from "@/lib/users";
import { loadDefaultMimicFn } from "@/hmi/data/mimic-store";

const fetchHmiUser = createServerFn().handler(async (): Promise<AppUser | null> => getCurrentUser());

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    const user = await fetchHmiUser();
    if (!user) throw redirect({ to: "/login", search: { from: location.pathname } });
    return { user };
  },
  loader: async () => ({ current: await loadDefaultMimicFn() }),
  component: HmiRoute,
  errorComponent: HmiError,
});

function HmiRoute() {
  const { current } = Route.useLoaderData();
  return <HmiPage initialMimic={current} />;
}

function HmiError({ error }: ErrorComponentProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{`页面错误：${error.message}`}</p>
    </div>
  );
}
```

删除原 `useState`/`useEffect`/`fetch`/`mimicSchema`/`apiUrl`/`CenteredMessage` 等不再用到的 import 与函数。

- [ ] **Step 2: 改 HmiPage prop + saveMimic**

`HmiPage.tsx`：
- 顶部 import 改：删 `import { saveSchema } from "@/hmi/data/save-schema";`，加 `import { saveMimicFn, type MimicRecord } from "@/hmi/data/mimic-store";`
- 签名（约 33 行）：

```tsx
export function HmiPage({ initialMimic }: { initialMimic: MimicRecord }) {
  return (
    <I18nProvider>
      <HmiPageInner initialMimic={initialMimic} />
    </I18nProvider>
  );
}

function HmiPageInner({ initialMimic }: { initialMimic: MimicRecord }) {
  const history = useHistory<Mimic>(initialMimic.data);
  // ...其余不变
```

（若 `HmiPage`/`HmiPageInner` 的 wrapper 结构与此处不同，仅把 `initialSchema: Mimic` 改为 `initialMimic: MimicRecord` 并用 `initialMimic.data` 喂 `useHistory`。）

- onSave（约 290 行）：

```tsx
onSave={async () => {
  await saveMimicFn({ data: { id: initialMimic.id, data: schema } });
}}
```

- [ ] **Step 3: 删除旧 save-schema.ts**

Run: `git rm src/hmi/data/save-schema.ts`

确认无其他引用：

Run: `grep -rn "save-schema\|saveSchema" src/`
Expected: 无输出

- [ ] **Step 4: 全量校验**

Run: `npx tsc --noEmit && npm run lint`
Expected: 均无错误

- [ ] **Step 5: 跑单测 + E2E（已有用例不应回归）**

Run: `npm test`
Expected: 全过（无库时 mimics 集成测试 skip）

Run: `npm run e2e`
Expected: 已有 5 条 E2E 全过（首页加载默认图 → loader 链路通）

- [ ] **Step 6: 浏览器实测**

起 `npm run dev:preview`，浏览器打开首页：加载默认图、拖动/编辑、点保存、刷新页面 → 改动保留（已落库）。截图确认。

- [ ] **Step 7: Commit**

```bash
git add src/routes/index.tsx src/hmi/components/HmiPage.tsx
git commit -m "feat(hmi): 首页 loader 读库 + HmiPage saveMimic 写库，删 save-schema"
```

---

# 阶段 2：多图 UI

> 阶段 1 跑通（默认图存库、保存回库）后做。当前图由 `?mimic=<id>` search param 驱动。

## Task 6: search param 驱动当前图

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: loader 按 search param 取图 + 带列表**

```tsx
import { z } from "zod";
import { loadDefaultMimicFn, loadMimicFn, listMimicsFn } from "@/hmi/data/mimic-store";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ mimic: z.string().optional() }),
  beforeLoad: async ({ location }) => { /* 不变 */ },
  loaderDeps: ({ search }) => ({ mimic: search.mimic }),
  loader: async ({ deps }) => {
    const [mimics, current] = await Promise.all([
      listMimicsFn(),
      deps.mimic ? loadMimicFn({ data: { id: deps.mimic } }) : loadDefaultMimicFn(),
    ]);
    return { mimics, current };
  },
  component: HmiRoute,
  errorComponent: HmiError,
});

function HmiRoute() {
  const { current } = Route.useLoaderData();
  return <HmiPage key={current.id} initialMimic={current} />;
}
```

`key={current.id}` 强制切图时重建 HmiPage（重置 history/选择态）。loader 返回的 `mimics` 暂不消费，Task 7 接进选择器。

- [ ] **Step 2: 校验**

Run: `npx tsc --noEmit`
Expected: 无错误（loader 已返回 mimics，Task 7 才把它接进 HmiPage 渲染选择器）

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(hmi): ?mimic search param 驱动当前图加载"
```

---

## Task 7: 图纸选择器 MimicSwitcher

**Files:**
- Create: `src/hmi/components/MimicSwitcher.tsx`
- Modify: `src/hmi/components/HmiPage.tsx`（接 `mimics` prop、渲染 switcher）
- Modify: `src/hmi/i18n/dict.ts`（新字符串）

- [ ] **Step 1: 加 i18n 词条**

在 `src/hmi/i18n/dict.ts` 的字典对象里加（zh-as-key，值为 en 译文）：

```ts
"图纸": "Mimic",
"新建图纸": "New mimic",
"重命名": "Rename",
"删除图纸": "Delete mimic",
"图纸名称": "Mimic name",
"确认删除该图纸？": "Delete this mimic?",
"至少保留一张图纸": "Keep at least one mimic",
```

- [ ] **Step 2: 写 MimicSwitcher.tsx**

下拉选当前图 + 新建/重命名/删除。沿用现有组件（`Topbar`/`SelectionBar`）的 Tailwind 风格与 `useT()` 用法。

```tsx
import { useRouter } from "@tanstack/react-router";
import { useT } from "@/hmi/i18n/context";
import {
  createMimicFn,
  renameMimicFn,
  deleteMimicFn,
  type MimicListItem,
} from "@/hmi/data/mimic-store";

interface MimicSwitcherProps {
  mimics: MimicListItem[];
  currentId: string;
  currentName: string;
}

export function MimicSwitcher({ mimics, currentId, currentName }: MimicSwitcherProps) {
  const t = useT();
  const router = useRouter();

  const goto = (id: string) => router.navigate({ to: "/", search: { mimic: id } });

  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => goto(e.target.value);

  const onNew = async () => {
    const name = window.prompt(t("图纸名称"));
    if (!name?.trim()) return;
    const row = await createMimicFn({ data: { name: name.trim() } });
    await router.invalidate();
    goto(row.id);
  };

  const onRename = async () => {
    const name = window.prompt(t("图纸名称"), currentName);
    if (!name?.trim()) return;
    await renameMimicFn({ data: { id: currentId, name: name.trim() } });
    await router.invalidate();
  };

  const onDelete = async () => {
    if (mimics.length <= 1) { window.alert(t("至少保留一张图纸")); return; }
    if (!window.confirm(t("确认删除该图纸？"))) return;
    await deleteMimicFn({ data: { id: currentId } });
    const fallback = mimics.find((m) => m.id !== currentId);
    await router.invalidate();
    if (fallback) goto(fallback.id);
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={currentId}
        onChange={onSelect}
        aria-label={t("图纸")}
        className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
      >
        {mimics.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <button onClick={onNew} className="h-7 rounded border border-border px-2 text-xs hover:bg-muted" title={t("新建图纸")}>+</button>
      <button onClick={onRename} className="h-7 rounded border border-border px-2 text-xs hover:bg-muted">{t("重命名")}</button>
      <button onClick={onDelete} className="h-7 rounded border border-border px-2 text-xs text-destructive hover:bg-muted" title={t("删除图纸")}>🗑</button>
    </div>
  );
}
```

> 注：`window.prompt/confirm/alert` 是最小可用实现。若项目有模态组件，按现有风格替换（不阻塞本任务）。

- [ ] **Step 3: HmiPage 接 mimics prop 并渲染 MimicSwitcher**

`HmiPage.tsx`：
- 签名加 `mimics: MimicListItem[]`（`HmiPageInner` 同步加该 prop 并透传给 switcher）：

```tsx
export function HmiPage({ initialMimic, mimics }: { initialMimic: MimicRecord; mimics: MimicListItem[] }) {
  return (
    <I18nProvider>
      <HmiPageInner initialMimic={initialMimic} mimics={mimics} />
    </I18nProvider>
  );
}
```
- import：`import { MimicSwitcher } from "./MimicSwitcher";` + `type { MimicListItem }` 来自 mimic-store
- 同步：Task 6 的 `HmiRoute` 此时改回传 `mimics`：`<HmiPage key={current.id} initialMimic={current} mimics={mimics} />`
- 在 `Topbar` 区域渲染 `<MimicSwitcher mimics={mimics} currentId={initialMimic.id} currentName={initialMimic.name} />`（具体挂载点按 Topbar 现有布局，放标题旁）

- [ ] **Step 4: 校验 + 浏览器实测**

Run: `npx tsc --noEmit && npm run lint`
Expected: 无错误

`dev:preview` 实测：新建图 → 选择器切换 → 编辑保存 → 重命名 → 删除回退。截图确认。i18n 切 EN 看新串是否翻译。

- [ ] **Step 5: Commit**

```bash
git add src/hmi/components/MimicSwitcher.tsx src/hmi/components/HmiPage.tsx src/hmi/i18n/dict.ts
git commit -m "feat(hmi): 多图选择器（列表/切换/新建/重命名/删除）+ i18n"
```

---

## Task 8: E2E 多图流程

**Files:**
- Modify: `e2e/hmi.spec.ts`

- [ ] **Step 1: 加 E2E 用例**

按 `e2e/hmi.spec.ts` 现有写法追加（选择器/文案对齐实际 DOM）：

```ts
test("多图：新建 → 切换 → 删除", async ({ page }) => {
  await page.goto("/");
  // 新建（prompt 用 page.on("dialog") 处理）
  page.once("dialog", (d) => d.accept("e2e-图"));
  await page.getByTitle("新建图纸").click();
  await expect(page.getByRole("combobox", { name: "图纸" })).toContainText("e2e-图");
  // 删除（confirm + 回退）
  page.once("dialog", (d) => d.accept());
  await page.getByTitle("删除图纸").click();
  await expect(page.getByRole("combobox", { name: "图纸" })).not.toContainText("e2e-图");
});
```

- [ ] **Step 2: 跑 E2E**

Run: `npm run e2e`
Expected: 全过（含新用例）

- [ ] **Step 3: Commit**

```bash
git add e2e/hmi.spec.ts
git commit -m "test(hmi): 多图新建/切换/删除 E2E"
```

---

## 收尾验证清单

- [ ] `npx tsc --noEmit` 干净
- [ ] `npm test` 全过（有库时含 mimics 集成测试）
- [ ] `npm run lint` 干净
- [ ] `npm run e2e` 全过
- [ ] `dev:preview` 实测：默认图加载/保存/刷新保留；多图新建/切换/重命名/删除；EN 下新 UI 字符串已翻译
- [ ] `default.json` 未被运行时改写（仅作 seed）
