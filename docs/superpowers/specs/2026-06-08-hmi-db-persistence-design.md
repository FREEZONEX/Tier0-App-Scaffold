# HMI Schema 持久化：文件 → Postgres 多图存储

**日期**：2026-06-08
**状态**：设计已批准，待写实现计划
**作者**：与用户协作 brainstorm

## 背景与目标

当前 HMI schema 走**单文件单图**持久化：

- **加载**：`src/routes/index.tsx` 客户端 `fetch("/schemas/default.json")` → `mimicSchema.safeParse` → `<HmiPage initialSchema>`。
- **保存**：`src/hmi/components/HmiPage.tsx:291` 调 `saveSchema` server fn → 写 `public/schemas/default.json`。
- **用户**：`AppUser`（id/username/displayName/role/email）来自 gateway header，**无 tenant 字段**。

项目已备好 Drizzle/Postgres 基建（`src/db/index.ts` 连接池、`src/services/bootstrap.ts` 运行时幂等建表、`drizzle.config.ts`），但 `src/db/schema.ts` 仍是空表模板，无任何读写库。

**目标**：把 schema 持久化从写文件改为 Postgres 多图存储，支持多张图命名、列表、切换、CRUD，为 SaaS 多工厂场景铺结构。

## 关键决策（brainstorm 已定）

1. **数据库**：本地 docker 起 Postgres，纯库存储，**不做文件 fallback**。`public/schemas/default.json` 降级为 seed 种子。
2. **存储模型**：多图命名 + 列表 + 切换 + CRUD。`tenant`/`owner` 列留 nullable，**不写隔离逻辑**（YAGNI，为 SaaS 留结构）。
3. **分两阶段增量验证**：阶段 1 先把「存库」跑通（行为等价现状），阶段 2 加多图 UI。

## 架构

数据单向流，分层清晰：

```
docker pg ── db/schema.ts (表定义)
              │
              ▼
        services/mimics.ts  ← Repository：bootstrap + CRUD（唯一碰 db 的层）
              │
              ▼
        hmi/data/*.ts       ← server fns：薄包装 + zod 校验（前后端边界）
              │
              ▼
        routes/index.tsx    ← route loader 服务端取数据 → HmiPage
              │
              ▼
        HmiPage / 图纸选择器 UI（阶段 2）
```

- **唯一碰 `db` 的地方是 `services/mimics.ts`**，便于测试与替换存储。
- server fn 不含业务逻辑，只做校验 + 转调 service。

## 阶段 1：持久化层切库

### ① DB 表 `src/db/schema.ts`

填掉空模板，新增 `mimics` 表：

```ts
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { Mimic } from "@/hmi/schema/schema";

export const mimics = pgTable("mimics", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:      text("name").notNull(),
  data:      jsonb("data").$type<Mimic>().notNull(),
  tenant:    text("tenant"),   // nullable，SaaS 预留，不做隔离
  owner:     text("owner"),    // nullable，gateway user id 预留
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export const insertMimicSchema = createInsertSchema(mimics);
export const selectMimicSchema = createSelectSchema(mimics);
export type MimicRow    = typeof mimics.$inferSelect;
export type NewMimicRow = typeof mimics.$inferInsert;
```

- 用 `jsonb`（非 `json`）——可查询、可索引。
- id 由应用层 `crypto.randomUUID()` 生成（`$defaultFn`），不依赖 DB 扩展。
- 类型/zod schema 由表派生，不手写。

### ② Repository service `src/services/mimics.ts`

Repository 模式，唯一访问 `db` 的层。每个公开入口先 `await bootstrapMimics()`。

```ts
// 运行时幂等建表 + 首次 seed
bootstrapMimics(): Promise<void>

// 列表只返元信息，不带大 json
listMimics(): Promise<MimicMeta[]>          // {id, name, createdAt, updatedAt}
getMimic(id): Promise<MimicRow | null>
createMimic(name, data): Promise<MimicRow>
updateMimic(id, data): Promise<MimicRow>    // 只改 data + updatedAt
renameMimic(id, name): Promise<MimicRow>
deleteMimic(id): Promise<void>
```

**bootstrap 用现成 `bootstrapModule("hmi", [...])`**：

- `createTable`: `create table if not exists mimics (...)`（幂等，列与上表一致；`data jsonb not null`，时间戳 `timestamptz default now()`）。
- `createIndexes`: 视需要加 `name` 索引。
- `seed`: **空表时**读 `public/schemas/default.json`（node fs，service 在 server 端）→ `mimicSchema.parse` 校验 → insert 一条 `name="default"`。这是从文件到库的**一次性数据迁移**。

### ③ Server fns `src/hmi/data/`

替换 `save-schema.ts`，新增一组 `createServerFn`，每个用 zod `inputValidator` 校验：

- `saveMimic({ id, data })` — 替换旧 `saveSchema`，调 `updateMimic`。
- `loadMimic({ id })` — 调 `getMimic`。
- `listMimicsFn()` — 调 `listMimics`。
- `createMimicFn({ name })` / `renameMimicFn({ id, name })` / `deleteMimicFn({ id })`。

输入校验：`id` 为 uuid 字符串；`data` 走 `mimicSchema.parse`；`name` 非空 trim。

### ④ 加载路径 `src/routes/index.tsx`

客户端 `fetch(静态文件)` → **route `loader` 服务端取数据**：

- 已有 `beforeLoad` 取 user，`loader` 中调 `listMimics` + 取默认图（阶段 1 选取规则：优先 `name="default"` 那条，缺失则取 `createdAt` 最早一条）。
- loader 返回 `{ mimics: MimicMeta[], current: MimicRow }` → 传 `<HmiPage>`。
- 删除客户端 `useEffect` + `fetch` + loading/error state（改由 loader + route `errorComponent` 承担）。

**库连不上** → loader 抛错 → 现有 `errorComponent` 显示（符合「纯库、无 fallback」预期）。

### ⑤ HmiPage 接口微调 `src/hmi/components/HmiPage.tsx`

- prop 从 `initialSchema: Mimic` 改为携带当前图 id 的形式（如 `initialMimic: { id, name, data }`），因为 `saveMimic` 需要 `id`。
- `HmiPage.tsx:291` 的 `saveSchema({ data: schema })` → `saveMimic({ id, data: schema })`。
- 阶段 1 不引入多图切换 UI，仅保证单默认图存库、保存回库。

### ⑥ docker pg + 环境

- 新增 `docker-compose.yml`：postgres 服务（指定版本、端口、卷）。
- 写 `.env`：`DATABASE_URL`（`.env` 已 gitignore，不入库）。
- `public/schemas/default.json` 保留为 **seed 种子**，运行时不再写它。
- 文档/README 补一句本地起库命令。

## 阶段 2：多图 UI

- **当前图用 search param** `?mimic=<id>` 驱动；loader 按 param 取，缺省回退默认图。
- **图纸选择器**（顶栏 `Topbar` 或独立组件）：下拉列出 `listMimics` 结果、切换；新建/重命名/删除按钮，分别调对应 server fn。
- **同步 i18n 词典**——所有新 UI 字符串走 `t()`/`translate(zh, getCanvasLang())` 并加进 `src/hmi/i18n/dict.ts`（zh-as-key），见记忆 `sync-i18n-on-new-ui`。
- 删除/重命名需确认交互；删除最后一张图时的兜底（保底保留或允许空 + 引导新建）。

## 数据流：保存与切换

- **保存**：HmiPage 编辑 → `saveMimic({id, data})` → `updateMimic` 写 `data`+`updatedAt`。
- **新建**：选择器「新建」→ `createMimicFn({name})`（data 用空白/模板 Mimic）→ 返回 id → 路由切到 `?mimic=<新id>`。
- **切换**：选择器选某图 → 改 search param → loader 取该图 → HmiPage 重渲染。

## 错误处理

- **连接失败**：loader / service 抛错；前端 errorComponent 兜底，文案中文友好。
- **校验失败**：server fn `inputValidator` 抛 zod error；写库前 `mimicSchema.parse` 把关，坏 schema 不落库（沿用旧 `saveSchema` 的「校验后才写」原则）。
- **找不到图**：`getMimic` 返回 null → loader 回退默认图或报「图纸不存在」。
- service 层不静默吞错——向上抛带上下文的错误。

## 测试策略

DB 测试需真库，与「无库也能跑」有张力，故：

- **Repository 集成测试** `src/services/mimics.test.ts`（node:test）：连 docker pg，每个用例用唯一 `name` 前缀隔离，`after` 清理测试行；`bootstrapMimics` 幂等可重复调。**无 `DATABASE_URL` 时整组 `test.skip` 优雅跳过**（CI 无库不红）。覆盖 CRUD round-trip、seed 行为、list 不带 data。
- **纯逻辑单测**：`default.json` → insert 映射、`mimicSchema` 校验等不依赖库的部分。
- **E2E**（阶段 2，Playwright）：新建图 → 切换 → 编辑 → 保存 → 刷新保留。
- server fn 是薄包装，测底层 service 即可，不单独测 server fn 框架行为。

## 迁移与回滚

- **迁移**：首次 `bootstrapMimics` 的 seed 把 `default.json` 灌为首条 `name="default"`，无需手动脚本。
- **`save-schema.ts` 删除**：其唯一调用方 `HmiPage.tsx:291` 改为 `saveMimic`；同时清掉 `routes/index.tsx` 客户端 fetch 逻辑。
- **回滚**：`default.json` 仍在仓库，恢复旧 `save-schema.ts` + 客户端 fetch 即可退回文件持久化。

## 风险

1. **测试依赖库**：CI 无 Postgres 时集成测试 skip，仅本地 docker 实测，集成层覆盖率不计入 CI。可接受。
2. **接口破坏**：`save-schema.ts` 删除、`HmiPage` prop 变化、`index.tsx` 加载逻辑重写——改动面集中在这三处，需一并改干净避免半态。
3. **阶段 2 i18n 遗漏**：新 UI 字符串漏翻会静默回退中文不报错，需对照词典自查。

## 不做（YAGNI）

- 多租户隔离逻辑（仅留 nullable 列）。
- 文件 fallback 双路径。
- schema 版本迁移 / 历史版本表。
- 图纸权限/共享。

## 验证清单

- `npx tsc --noEmit` 干净
- `npm test`（无库时集成测试 skip，其余通过）
- `npm run lint` 干净
- docker pg 起库后 `dev:preview` 浏览器实测：加载默认图、编辑保存、刷新保留；阶段 2 加多图新建/切换/重命名/删除
