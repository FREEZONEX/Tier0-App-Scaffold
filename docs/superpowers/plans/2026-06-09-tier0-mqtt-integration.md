# Tier0 MQTT 集成 + 发布模板立即存（A+B）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布模板"存为模板"立即落库；MQTT 连接/订阅/发布从 mqtt.js 直连换成 `@tier0/sdk` 的 `Tier0MQClient`（broker 从平台 env），无 Tier0 env 时用 mock 兜底。

**Architecture:** `tier0-source.ts` 包装 `Tier0MQClient` 实现现有 `DataSource`；`source-factory.ts` 按 env 选 Tier0 或 mock 兜底；HmiPage 去掉 mock/live 切换改用工厂。`schema.broker` 弃用。

**Tech Stack:** `@tier0/sdk`（mq 模块）、TanStack Start、zod、node:test、Playwright。

**Spec:** `docs/superpowers/specs/2026-06-09-tier0-sdk-integration-design.md`（本 plan 覆盖其 A、B；C「UNS 选 topic」待本 plan 完成、SDK 装上后单独 plan）

---

## 关键参考

- **`Tier0MQClient`**（`@tier0/sdk/mq`）：`subscribe(topic, (topic,payload:string)=>void)` 懒连接、`unsubscribe`、`publish(topic, payload)`、`on("connect"|"disconnect"|"error", cb)`、`disconnect()`。host/key 从 env（`VITE_TIER0_MQTT_HOST`/`PORT`/`VITE_TIER0_API_KEY`）。
- **现有 `DataSource`**（`src/hmi/data/data-source.ts`）：`connect`/`disconnect`/`onMessage`/`onStatus`/`status`/`publish`。
- **mock 兜底**：`createMockSource(mockSpecsFromSchema(schema))`（`mock-source.ts` + `mock-spec.ts`，保留）。
- **删除目标**：`mqtt-client.ts`（mqtt.js 直连）+ `mqtt-client.test.ts`。
- **sourceMode 用法**：HmiPage 63(state)/96-98(effect 创建)/110(依赖)/222-223(Topbar props)；Topbar 22-23,35-36(props)/47-51(UI)。
- **测试**：node:test，`node --import tsx --test <file>`。

---

## File Structure

- **Modify** `src/hmi/components/HmiPage.tsx` — A: onSavePreset/onRemovePreset 立即存；B: 去 sourceMode、用 source-factory
- **Create** `src/hmi/data/tier0-source.ts` — 包装 Tier0MQClient → DataSource（可注入测试）
- **Create** `src/hmi/data/tier0-source.test.ts`
- **Create** `src/hmi/data/source-factory.ts` — env-gated 选源
- **Create** `src/hmi/data/source-factory.test.ts`
- **Modify** `src/hmi/components/Topbar.tsx` — 删 source-mode props + UI；broker 显示改 env
- **Delete** `src/hmi/data/mqtt-client.ts` + `mqtt-client.test.ts`
- **Modify** `e2e/hmi.spec.ts` — 删失效的"切换实时源"用例
- **Modify** `.env.example` — 补 `VITE_TIER0_*`

---

## Task 1: A — 发布模板立即存库

**Files:** Modify `src/hmi/components/HmiPage.tsx`

- [ ] **Step 1: 改 onSavePreset + onRemovePreset 立即存**

把 `onSavePreset`（331 行）与 `onRemovePreset`（332 行）改为先算 `next`、commit + 立即 `saveMimicFn`：
```tsx
onSavePreset={(topic, template) => {
  const next = setNodePublishPreset(schema, selectedNode.id, topic, template);
  history.commit(() => next);
  void saveMimicFn({ data: { id: initialMimic.id, data: next } });
}}
onRemovePreset={(topic) => {
  const next = removeNodePublishPreset(schema, selectedNode.id, topic);
  history.commit(() => next);
  void saveMimicFn({ data: { id: initialMimic.id, data: next } });
}}
```

- [ ] **Step 2: 校验**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/hmi/components/HmiPage.tsx
git commit -m "feat(hmi): 发布模板存/删即落库（commit + 立即 saveMimic）"
```

---

## Task 2: 安装 @tier0/sdk

**Files:** Modify `package.json`

- [ ] **Step 1: 安装**

Run: `npm install @tier0/sdk`
Expected: `added ... @tier0/sdk`

- [ ] **Step 2: 确认子路径可解析**

Run: `node -e "require.resolve('@tier0/sdk/mq')" && echo OK`
Expected: `OK`（验证 `@tier0/sdk/mq` 导出存在）

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 安装 @tier0/sdk"
```

---

## Task 3: tier0-source.ts

**Files:** Create `src/hmi/data/tier0-source.ts` + `tier0-source.test.ts`

- [ ] **Step 1: 写失败测试 `tier0-source.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTier0Source, type Tier0ClientLike } from "./tier0-source";

function makeFake() {
  const subs: Array<{ topic: string; h: (t: string, p: string) => void }> = [];
  const pubs: Array<{ topic: string; payload: unknown }> = [];
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  const client: Tier0ClientLike = {
    subscribe(topic, h) { subs.push({ topic, h }); },
    unsubscribe() {},
    publish(topic, payload) { pubs.push({ topic, payload }); return Promise.resolve(); },
    on(ev, cb) { (handlers[ev] ??= []).push(cb as (...a: unknown[]) => void); },
    disconnect() {},
  };
  return { client, subs, pubs, emit: (ev: string, ...a: unknown[]) => handlers[ev]?.forEach((c) => c(...a)) };
}

describe("tier0-source", () => {
  it("connect → 订阅 topics，on(connect) → status connected", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a", "t/b"], () => fake.client);
    src.connect();
    assert.equal(src.status, "connecting");
    assert.deepEqual(fake.subs.map((s) => s.topic), ["t/a", "t/b"]);
    fake.emit("connect");
    assert.equal(src.status, "connected");
  });

  it("subscribe handler 收到消息 → onMessage 转发（JSON parse）", () => {
    const fake = makeFake();
    const src = createTier0Source(["t/a"], () => fake.client);
    const got: unknown[] = [];
    src.onMessage((m) => got.push(m));
    src.connect();
    fake.subs[0].h("t/a", '{"v":1}');
    assert.deepEqual(got, [{ topic: "t/a", payload: { v: 1 } }]);
  });

  it("publish → client.publish", () => {
    const fake = makeFake();
    const src = createTier0Source([], () => fake.client);
    src.connect();
    src.publish("cmd/x", { run: true });
    assert.deepEqual(fake.pubs, [{ topic: "cmd/x", payload: { run: true } }]);
  });

  it("disconnect → status disconnected", () => {
    const fake = makeFake();
    const src = createTier0Source([], () => fake.client);
    src.connect();
    src.disconnect();
    assert.equal(src.status, "disconnected");
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --import tsx --test src/hmi/data/tier0-source.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `tier0-source.ts`**

```ts
import { Tier0MQClient } from "@tier0/sdk/mq";
import type { ConnectionStatus, DataMessage, DataSource } from "./data-source";

/** Tier0MQClient 的最小类型面（便于注入假实现测试）。 */
export interface Tier0ClientLike {
  subscribe(topic: string, handler: (topic: string, payload: string) => void): void;
  unsubscribe(topic: string, handler?: (topic: string, payload: string) => void): void;
  publish(topic: string, payload: unknown): Promise<void> | void;
  on(event: "connect" | "disconnect" | "error", cb: (...args: never[]) => void): void;
  disconnect(): void;
}

const decode = (payload: string): unknown => {
  try { return JSON.parse(payload); } catch { return payload; }
};

/** 包装 Tier0MQClient 为 DataSource。makeClient 默认 new Tier0MQClient()（host/key 从 env）。 */
export function createTier0Source(
  topics: readonly string[],
  makeClient: () => Tier0ClientLike = () => new Tier0MQClient() as unknown as Tier0ClientLike,
): DataSource {
  let client: Tier0ClientLike | null = null;
  let status: ConnectionStatus = "disconnected";
  const msgCbs = new Set<(m: DataMessage) => void>();
  const statusCbs = new Set<(s: ConnectionStatus, e?: Error) => void>();
  const setStatus = (s: ConnectionStatus, e?: Error) => { status = s; statusCbs.forEach((c) => c(s, e)); };
  const handler = (topic: string, payload: string) => {
    const m: DataMessage = { topic, payload: decode(payload) };
    msgCbs.forEach((c) => c(m));
  };
  return {
    get status() { return status; },
    connect() {
      setStatus("connecting");
      client = makeClient();
      client.on("connect", () => setStatus("connected"));
      client.on("disconnect", () => setStatus("disconnected"));
      client.on("error", ((e: Error) => setStatus("error", e)) as (...a: never[]) => void);
      topics.forEach((t) => client!.subscribe(t, handler));
    },
    disconnect() { client?.disconnect(); client = null; setStatus("disconnected"); },
    onMessage(cb) { msgCbs.add(cb); return () => { msgCbs.delete(cb); }; },
    onStatus(cb) { statusCbs.add(cb); return () => { statusCbs.delete(cb); }; },
    publish(topic, payload) { void client?.publish(topic, payload); },
  };
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --import tsx --test src/hmi/data/tier0-source.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add src/hmi/data/tier0-source.ts src/hmi/data/tier0-source.test.ts
git commit -m "feat(hmi): tier0-source 包装 Tier0MQClient 为 DataSource"
```

---

## Task 4: source-factory.ts

**Files:** Create `src/hmi/data/source-factory.ts` + `source-factory.test.ts`

- [ ] **Step 1: 写失败测试 `source-factory.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDataSource } from "./source-factory";
import { parseMimic, type Mimic } from "@/hmi/schema/schema";

const base: Mimic = parseMimic({ meta: { name: "x" }, nodes: [{ id: "P-1", type: "pump", x: 0, y: 0 }] }).data!;

describe("source-factory", () => {
  it("无 Tier0 → mock 兜底源（有 tick）", () => {
    const src = createDataSource(base, ["t/a"], false);
    assert.ok("tick" in src, "mock 源应有 tick");
  });
  it("有 Tier0 → tier0 源（无 tick）", () => {
    const src = createDataSource(base, ["t/a"], true);
    assert.ok(!("tick" in src), "tier0 源无 tick");
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --import tsx --test src/hmi/data/source-factory.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `source-factory.ts`**

```ts
import { createMockSource } from "./mock-source";
import { createTier0Source } from "./tier0-source";
import { mockSpecsFromSchema } from "./mock-spec";
import type { DataSource } from "./data-source";
import type { Mimic } from "@/hmi/schema/schema";

/**
 * 有 Tier0 env 用真实 Tier0 源；否则 mock 兜底（喂当前图仿真数据，本地/E2E 不破）。
 * tier0Available 默认读 env（仅调用时求值，测试可显式传参绕过 import.meta.env）。
 */
export function createDataSource(
  schema: Mimic,
  topics: readonly string[],
  tier0Available: boolean = !!import.meta.env?.VITE_TIER0_MQTT_HOST,
): DataSource {
  return tier0Available
    ? createTier0Source(topics)
    : createMockSource(mockSpecsFromSchema(schema));
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --import tsx --test src/hmi/data/source-factory.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add src/hmi/data/source-factory.ts src/hmi/data/source-factory.test.ts
git commit -m "feat(hmi): source-factory env-gated 选 Tier0 / mock 兜底"
```

---

## Task 5: HmiPage + Topbar 去 mock/live 切换

**Files:** Modify `src/hmi/components/HmiPage.tsx` + `Topbar.tsx`

- [ ] **Step 1: HmiPage import 换**

删 24-26 行 `createMockSource`/`createMqttSource`/`mockSpecsFromSchema` import，换成：
```ts
import { createDataSource } from "@/hmi/data/source-factory";
```

- [ ] **Step 2: 删 sourceMode state**

删 63 行 `const [sourceMode, setSourceMode] = useState<"mock" | "live">("mock");`

- [ ] **Step 3: 数据源 effect 用工厂**

把 effect 里创建源那段（96-98）：
```ts
    const source =
      sourceMode === "live"
        ? createMqttSource({ url: schema.broker?.url ?? "", topics: schemaTopics(schema) })
        : createMockSource(mockSpecsFromSchema(schema));
```
改为：
```ts
    const source = createDataSource(schema, schemaTopics(schema));
```
并把依赖数组（110 行）`[connected, sourceMode, schema, tagStore]` 改为 `[connected, schema, tagStore]`。

- [ ] **Step 4: Topbar 调用去 source-mode props**

删 HmiPage 222-223 行传给 `<Topbar>` 的 `sourceMode={sourceMode}` 和 `onSourceModeChange={setSourceMode}`。

- [ ] **Step 5: Topbar 删 props + UI**

`Topbar.tsx`：
- 解构删 `sourceMode,`（22）`onSourceModeChange,`（23）；类型删 `sourceMode: "mock" | "live";`（35）`onSourceModeChange: (m: "mock" | "live") => void;`（36）
- 删 47-51 行整个 `data-testid="source-mode"` 的 `<div>`（仿真/实时按钮）

- [ ] **Step 6: broker 显示改 env（HmiPage 那侧）**

HmiPage 218 行传给 Topbar 的 `brokerUrl`，从 `schema.broker?.url ?? "—"` 改为：
```tsx
        brokerUrl={import.meta.env?.VITE_TIER0_MQTT_HOST ?? "dev (mock)"}
```

- [ ] **Step 7: 校验**

Run: `npx tsc --noEmit && npm run lint`
Expected: 无错误（mqtt-client 仍在，下一 task 删）

- [ ] **Step 8: Commit**

```bash
git add src/hmi/components/HmiPage.tsx src/hmi/components/Topbar.tsx
git commit -m "feat(hmi): 去 mock/live 切换，数据源走 env-gated 工厂"
```

---

## Task 6: 删 mqtt-client + 失效 E2E

**Files:** Delete `mqtt-client.ts`/`mqtt-client.test.ts`；Modify `e2e/hmi.spec.ts`

- [ ] **Step 1: 删 mqtt-client**

Run: `git rm src/hmi/data/mqtt-client.ts src/hmi/data/mqtt-client.test.ts`

确认无残留引用：

Run: `grep -rn "mqtt-client\|createMqttSource" src/`
Expected: 无输出

- [ ] **Step 2: 删失效 E2E 用例**

`e2e/hmi.spec.ts` 删整个 `test("切换实时源且无 broker：报连接错误但不崩溃", ...)`（115-136 行）——source-mode 切换 UI 已删，该用例不再适用。

- [ ] **Step 3: 校验**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 干净；测试全过（少了 mqtt-client.test，多了 tier0-source/source-factory）

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(hmi): 删 mqtt-client（换 Tier0）+ 失效的 source-mode E2E"
```

---

## Task 7: env 示例 + 文档

**Files:** Modify `.env.example`、`docs/platform-integration.md`

- [ ] **Step 1: .env.example 补 Tier0 变量**

在 `.env.example` 末尾追加（无该文件则 `touch .env.example` 后写）：
```bash
# Tier0 SDK（平台注入；本地留空则用 mock 兜底数据源）
VITE_TIER0_MQTT_HOST=
VITE_TIER0_MQTT_PORT=8084
VITE_TIER0_API_HOST=
VITE_TIER0_API_KEY=
```

- [ ] **Step 2: platform-integration.md 补一节**

在 `docs/platform-integration.md` 末尾追加说明：MQTT 连接走 `@tier0/sdk`，broker/key 从 `VITE_TIER0_MQTT_HOST`/`PORT`/`VITE_TIER0_API_KEY` 读；缺失时前端回退 mock 兜底源（dev/演示用）。

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/platform-integration.md
git commit -m "docs: Tier0 env 变量说明 + mock 兜底"
```

---

## Task 8: 全量验证

- [ ] **Step 1: tsc + lint + 单测**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc 0、lint 仅既有噪音、单测全过

- [ ] **Step 2: E2E**

Run: `npm run e2e`
Expected: 现有数据相关用例靠 mock 兜底不破（既有 i18n pre-existing 失败除外）

- [ ] **Step 3: 浏览器实测（dev 无 Tier0 env）**

`npm run dev:preview`：mock 兜底有数据、画布正常、顶栏 broker 显示 `dev (mock)`、无 mock/live 切换按钮、发布 mock 回显、存模板刷新保留。截图确认。

---

## 收尾验证清单
- [ ] `tsc --noEmit` + `npm test` + `eslint` 干净
- [ ] dev（无 Tier0 env）：mock 兜底数据正常、无 mock/live 切换、存模板即存
- [ ] C（UNS 选 topic）待后续 plan（SDK 已装，`unsApi` 类型可查）
