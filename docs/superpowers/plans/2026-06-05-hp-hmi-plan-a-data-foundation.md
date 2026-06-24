# HP-HMI 计划A — 数据/模型地基 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 HP-HMI 模板的纯逻辑地基——schema 校验、绑定解析、tag 存储、场景图、数据源（mock + mqtt）——全部可单测，零 UI / 零 Canvas 依赖。

**Architecture:** 自底向上的纯 TypeScript 模块，位于 `src/hmi/{schema,data}`。所有数据不可变更新；所有外部输入经 zod / 显式校验；数据源走统一 `DataSource` 接口，真实 mqtt 与 mock 仿真可互换。渲染层（计划B）与页面层（计划C）将消费这一层，但本层不反向依赖它们。

**Tech Stack:** TypeScript (strict, ESM), zod v4, mqtt.js, `node:test` + `tsx` 测试。

参考 spec：`docs/superpowers/specs/2026-06-05-hp-hmi-mimic-template-design.md`（§3 状态语言、§6 Schema、§8 错误处理）。

---

## 文件结构（本计划产出）

```
src/hmi/
  schema/
    schema.ts            # zod schema + 类型 + parseMimic
    schema.test.ts
  data/
    binding.ts           # resolvePath(dot/bracket) + resolveBinding
    binding.test.ts
    tag-store.ts         # topic→payload 存储, 不可变, 可订阅
    tag-store.test.ts
    data-source.ts       # DataSource 接口 + 类型（无测试，纯类型）
    mock-source.ts       # 仿真数据源
    mock-source.test.ts
    mqtt-client.ts       # mqtt.js 包装（DI 可测）
    mqtt-client.test.ts
  scene/
    scene.ts             # Mimic → Scene, 不可变选中, resolveNodeState
    scene.test.ts
```

约定：`src/hmi` 内部模块之间用**相对导入**（`../schema/schema`），不用 `@/` 别名——避免 tsx 测试运行器的别名解析问题。

---

## Task 0: 依赖与测试基建

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 初始化 git（如尚未初始化，启用下方 commit 步骤）**

Run:
```bash
git rev-parse --is-inside-work-tree 2>/dev/null || (git init && git add -A && git commit -m "chore: snapshot template before HMI work")
```
Expected: 已是 git 仓库则跳过；否则建库并提交当前模板。

- [ ] **Step 2: 安装 mqtt 依赖**

Run: `npm install mqtt@^5`
Expected: `package.json` 的 `dependencies` 出现 `"mqtt"`。

- [ ] **Step 3: 添加 test 脚本**

修改 `package.json` 的 `scripts`，新增一行（放在 `"lint"` 之后）：
```json
    "test": "node --import tsx --test \"src/**/*.test.ts\"",
```

- [ ] **Step 4: 冒烟测试——确认测试器能跑 TS**

创建临时文件 `src/hmi/_smoke.test.ts`：
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

test("tsx + node:test works", () => {
  assert.equal(1 + 1, 2);
});
```

Run: `node --import tsx --test src/hmi/_smoke.test.ts`
Expected: PASS（1 test passed）。

- [ ] **Step 5: 删除冒烟文件**

Run: `rm src/hmi/_smoke.test.ts`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mqtt dep and node:test/tsx test script"
```

---

## Task 1: Schema 定义与校验

**Files:**
- Create: `src/hmi/schema/schema.ts`
- Test: `src/hmi/schema/schema.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/schema/schema.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMimic } from "./schema";

const valid = {
  meta: { name: "1#车间", version: 1 },
  broker: { url: "ws://broker.local:9001" },
  nodes: [
    {
      id: "P-01",
      type: "pump",
      x: 240,
      y: 110,
      label: "P-01 离心泵",
      topics: ["t/telemetry"],
      bindings: { running: { topic: "t/telemetry", path: "status" } },
      inline: ["running"],
    },
  ],
  edges: [
    { id: "e1", from: "TK-01", to: "P-01", points: [[110, 110], [150, 110]] },
  ],
};

describe("parseMimic", () => {
  it("接受合法 schema 并填默认值", () => {
    const result = parseMimic(valid);
    assert.equal(result.ok, true);
    assert.equal(result.data?.nodes[0].rotation, 0); // default
    assert.equal(result.data?.edges[0].flowBy, undefined);
  });

  it("缺 meta.name 时返回字段级错误", () => {
    const bad = { ...valid, meta: { version: 1 } };
    const result = parseMimic(bad);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /meta\.name/);
  });

  it("edge.points 少于 2 个点被拒", () => {
    const bad = { ...valid, edges: [{ id: "e1", from: "a", to: "b", points: [[1, 1]] }] };
    const result = parseMimic(bad);
    assert.equal(result.ok, false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --import tsx --test src/hmi/schema/schema.test.ts`
Expected: FAIL（`Cannot find module './schema'`）。

- [ ] **Step 3: 实现 schema.ts**

`src/hmi/schema/schema.ts`:
```ts
import { z } from "zod";

export const bindingSchema = z.object({
  topic: z.string().min(1),
  path: z.string().min(1),
});
export type Binding = z.infer<typeof bindingSchema>;

export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  label: z.string().optional(),
  topics: z.array(z.string()).default([]),
  bindings: z.record(z.string(), bindingSchema).default({}),
  inline: z.array(z.string()).default([]),
});
export type MimicNode = z.infer<typeof nodeSchema>;

export const edgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  points: z.array(z.tuple([z.number(), z.number()])).min(2),
  flowBy: bindingSchema.optional(),
});
export type MimicEdge = z.infer<typeof edgeSchema>;

export const mimicSchema = z.object({
  meta: z.object({ name: z.string().min(1), version: z.number().default(1) }),
  broker: z.object({ url: z.string().min(1) }).optional(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema).default([]),
});
export type Mimic = z.infer<typeof mimicSchema>;

export interface ParseResult {
  readonly ok: boolean;
  readonly data?: Mimic;
  readonly error?: string;
}

/**
 * 校验未知输入为 Mimic。失败返回字段级错误信息，绝不抛异常 / 不返回半张图。
 */
export function parseMimic(input: unknown): ParseResult {
  const result = mimicSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.join(".");
    return { ok: false, error: `${path || "(root)"}: ${first.message}` };
  }
  return { ok: true, data: result.data };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --import tsx --test src/hmi/schema/schema.test.ts`
Expected: PASS（3 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/hmi/schema/
git commit -m "feat(hmi): mimic schema with zod validation"
```

---

## Task 2: 绑定解析（路径 + topic→值）

**Files:**
- Create: `src/hmi/data/binding.ts`
- Test: `src/hmi/data/binding.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/data/binding.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePath, resolveBinding } from "./binding";

describe("resolvePath", () => {
  it("取嵌套字段", () => {
    assert.equal(resolvePath({ a: { b: 5 } }, "a.b"), 5);
  });
  it("取数组下标", () => {
    assert.equal(resolvePath({ a: [{ c: 9 }] }, "a[0].c"), 9);
  });
  it("路径不存在返回 undefined", () => {
    assert.equal(resolvePath({ a: 1 }, "a.b.c"), undefined);
  });
  it("源为 null 返回 undefined", () => {
    assert.equal(resolvePath(null, "a"), undefined);
  });
});

describe("resolveBinding", () => {
  it("用 topic 取 payload 再按 path 取值", () => {
    const payloads: Record<string, unknown> = { "t/x": { alarm: { active: true } } };
    const value = resolveBinding((topic) => payloads[topic], {
      topic: "t/x",
      path: "alarm.active",
    });
    assert.equal(value, true);
  });
  it("topic 无数据返回 undefined", () => {
    const value = resolveBinding(() => undefined, { topic: "t/missing", path: "a" });
    assert.equal(value, undefined);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --import tsx --test src/hmi/data/binding.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 binding.ts**

`src/hmi/data/binding.ts`:
```ts
import type { Binding } from "../schema/schema";

/**
 * 解析点/方括号路径（如 "a.b[0].c"）。任一环节缺失返回 undefined，不抛异常。
 */
export function resolvePath(source: unknown, path: string): unknown {
  const tokens = path.replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
  let current: unknown = source;
  for (const token of tokens) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

/** 用 getPayload(topic) 取出 payload，再按 binding.path 解析出值。 */
export function resolveBinding(
  getPayload: (topic: string) => unknown,
  binding: Binding,
): unknown {
  return resolvePath(getPayload(binding.topic), binding.path);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --import tsx --test src/hmi/data/binding.test.ts`
Expected: PASS（6 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/hmi/data/binding.ts src/hmi/data/binding.test.ts
git commit -m "feat(hmi): JSONPath-style binding resolver"
```

---

## Task 3: Tag 存储

**Files:**
- Create: `src/hmi/data/tag-store.ts`
- Test: `src/hmi/data/tag-store.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/data/tag-store.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTagStore } from "./tag-store";

describe("createTagStore", () => {
  it("存取最新 payload", () => {
    const store = createTagStore();
    store.setMessage("t/a", { v: 1 });
    assert.deepEqual(store.get("t/a"), { v: 1 });
  });

  it("setMessage 通知订阅者", () => {
    const store = createTagStore();
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.setMessage("t/a", 1);
    store.setMessage("t/a", 2);
    assert.equal(calls, 2);
  });

  it("getSnapshot 在两次 setMessage 之间引用稳定", () => {
    const store = createTagStore();
    const s1 = store.getSnapshot();
    const s2 = store.getSnapshot();
    assert.equal(s1, s2); // 同引用 → useSyncExternalStore 友好
    store.setMessage("t/a", 1);
    assert.notEqual(store.getSnapshot(), s1); // 更新后换新引用
  });

  it("退订后不再收到通知", () => {
    const store = createTagStore();
    let calls = 0;
    const off = store.subscribe(() => { calls += 1; });
    off();
    store.setMessage("t/a", 1);
    assert.equal(calls, 0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --import tsx --test src/hmi/data/tag-store.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 tag-store.ts**

`src/hmi/data/tag-store.ts`:
```ts
export interface TagSnapshot {
  /** 取某 topic 当前 payload，无则 undefined。 */
  get(topic: string): unknown;
}

export interface TagStore {
  setMessage(topic: string, payload: unknown): void;
  get(topic: string): unknown;
  subscribe(listener: () => void): () => void;
  /** 返回不可变快照，引用仅在 setMessage 后变化（useSyncExternalStore 友好）。 */
  getSnapshot(): TagSnapshot;
}

export function createTagStore(): TagStore {
  let payloads: Record<string, unknown> = {};
  const listeners = new Set<() => void>();

  const build = (source: Record<string, unknown>): TagSnapshot => ({
    get: (topic) => source[topic],
  });
  let snapshot: TagSnapshot = build(payloads);

  return {
    setMessage(topic, payload) {
      payloads = { ...payloads, [topic]: payload }; // 不可变
      snapshot = build(payloads);
      listeners.forEach((listener) => listener());
    },
    get(topic) {
      return payloads[topic];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --import tsx --test src/hmi/data/tag-store.test.ts`
Expected: PASS（4 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/hmi/data/tag-store.ts src/hmi/data/tag-store.test.ts
git commit -m "feat(hmi): immutable observable tag store"
```

---

## Task 4: 场景图与图元状态解析

**Files:**
- Create: `src/hmi/scene/scene.ts`
- Test: `src/hmi/scene/scene.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/scene/scene.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMimic } from "../schema/schema";
import { buildScene, selectNode, resolveNodeState } from "./scene";

const mimic = parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    {
      id: "P-01",
      type: "pump",
      x: 0,
      y: 0,
      topics: ["t/p"],
      bindings: {
        running: { topic: "t/p", path: "status" },
        fault: { topic: "t/p", path: "alarm" },
      },
    },
  ],
  edges: [],
}).data!;

describe("buildScene", () => {
  it("建立 byId 索引且初始无选中", () => {
    const scene = buildScene(mimic);
    assert.equal(scene.byId["P-01"].type, "pump");
    assert.equal(scene.selectedId, null);
  });
});

describe("selectNode (不可变)", () => {
  it("返回新对象，原对象不变", () => {
    const scene = buildScene(mimic);
    const next = selectNode(scene, "P-01");
    assert.equal(next.selectedId, "P-01");
    assert.equal(scene.selectedId, null);
    assert.notEqual(scene, next);
  });
});

describe("resolveNodeState", () => {
  it("解析 running/fault 布尔（接受字符串/数字）", () => {
    const payloads: Record<string, unknown> = { "t/p": { status: "RUN", alarm: 0 } };
    const state = resolveNodeState(mimic.nodes[0], (t) => payloads[t]);
    assert.equal(state.running, true);
    assert.equal(state.fault, false);
    assert.equal(state.stale, false);
  });

  it("有 topics 但全无数据 → stale", () => {
    const state = resolveNodeState(mimic.nodes[0], () => undefined);
    assert.equal(state.stale, true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --import tsx --test src/hmi/scene/scene.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 scene.ts**

`src/hmi/scene/scene.ts`:
```ts
import type { Mimic, MimicNode, MimicEdge } from "../schema/schema";
import { resolveBinding } from "../data/binding";

export interface Scene {
  readonly meta: Mimic["meta"];
  readonly nodes: readonly MimicNode[];
  readonly edges: readonly MimicEdge[];
  readonly byId: Readonly<Record<string, MimicNode>>;
  readonly selectedId: string | null;
}

export function buildScene(mimic: Mimic): Scene {
  const byId: Record<string, MimicNode> = {};
  for (const node of mimic.nodes) {
    byId[node.id] = node;
  }
  return {
    meta: mimic.meta,
    nodes: mimic.nodes,
    edges: mimic.edges,
    byId,
    selectedId: null,
  };
}

/** 不可变更新选中节点。 */
export function selectNode(scene: Scene, id: string | null): Scene {
  return { ...scene, selectedId: id };
}

export interface NodeState {
  readonly values: Readonly<Record<string, unknown>>;
  readonly running: boolean;
  readonly fault: boolean;
  readonly stale: boolean;
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["1", "true", "run", "running", "on", "open"].includes(
      value.toLowerCase(),
    );
  }
  return false;
}

/**
 * 把节点绑定解析为视觉状态。有 topics 但一个值都没取到视为失联(stale)。
 */
export function resolveNodeState(
  node: MimicNode,
  getPayload: (topic: string) => unknown,
): NodeState {
  const values: Record<string, unknown> = {};
  let anyResolved = false;
  for (const [key, binding] of Object.entries(node.bindings)) {
    const value = resolveBinding(getPayload, binding);
    values[key] = value;
    if (value !== undefined) anyResolved = true;
  }
  return {
    values,
    running: toBool(values.running),
    fault: toBool(values.fault),
    stale: node.topics.length > 0 && !anyResolved,
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --import tsx --test src/hmi/scene/scene.test.ts`
Expected: PASS（4 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/hmi/scene/
git commit -m "feat(hmi): scene graph and node state resolution"
```

---

## Task 5: DataSource 接口 + Mock 数据源

**Files:**
- Create: `src/hmi/data/data-source.ts`
- Create: `src/hmi/data/mock-source.ts`
- Test: `src/hmi/data/mock-source.test.ts`

- [ ] **Step 1: 写 DataSource 接口（纯类型，无测试）**

`src/hmi/data/data-source.ts`:
```ts
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface DataMessage {
  readonly topic: string;
  readonly payload: unknown;
}

/** 真实 mqtt 与 mock 仿真共用此接口，页面可无缝切换。 */
export interface DataSource {
  connect(): void;
  disconnect(): void;
  onMessage(callback: (message: DataMessage) => void): () => void;
  onStatus(callback: (status: ConnectionStatus) => void): () => void;
  readonly status: ConnectionStatus;
}
```

- [ ] **Step 2: 写失败测试**

`src/hmi/data/mock-source.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockSource } from "./mock-source";

describe("createMockSource", () => {
  it("tick 时按 shape 向订阅者发消息", () => {
    const source = createMockSource([
      { topic: "t/level", shape: (t) => ({ level: t }) },
    ]);
    const received: unknown[] = [];
    source.onMessage((m) => received.push(m));
    source.tick(3);
    assert.deepEqual(received, [{ topic: "t/level", payload: { level: 3 } }]);
  });

  it("connect → connected，disconnect → disconnected", () => {
    const source = createMockSource([]);
    const statuses: string[] = [];
    source.onStatus((s) => statuses.push(s));
    source.connect();
    assert.equal(source.status, "connected");
    source.disconnect();
    assert.equal(source.status, "disconnected");
    assert.deepEqual(statuses, ["connecting", "connected", "disconnected"]);
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `node --import tsx --test src/hmi/data/mock-source.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现 mock-source.ts**

`src/hmi/data/mock-source.ts`:
```ts
import type { ConnectionStatus, DataMessage, DataSource } from "./data-source";

export interface MockTopicSpec {
  readonly topic: string;
  /** 纯函数：步数 t → payload。例如 t => ({ level: 50 + 40 * Math.sin(t / 10) })。 */
  readonly shape: (t: number) => unknown;
}

export interface MockSource extends DataSource {
  /** 手动推进一步（测试用，绕开计时器）。 */
  tick(step: number): void;
}

export function createMockSource(
  specs: readonly MockTopicSpec[],
  intervalMs = 1000,
): MockSource {
  let status: ConnectionStatus = "disconnected";
  const messageCallbacks = new Set<(message: DataMessage) => void>();
  const statusCallbacks = new Set<(status: ConnectionStatus) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let counter = 0;

  const setStatus = (next: ConnectionStatus) => {
    status = next;
    statusCallbacks.forEach((callback) => callback(next));
  };

  const tick = (step: number) => {
    for (const spec of specs) {
      const message: DataMessage = { topic: spec.topic, payload: spec.shape(step) };
      messageCallbacks.forEach((callback) => callback(message));
    }
  };

  return {
    get status() {
      return status;
    },
    connect() {
      setStatus("connecting");
      setStatus("connected");
      timer = setInterval(() => {
        counter += 1;
        tick(counter);
      }, intervalMs);
    },
    disconnect() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      setStatus("disconnected");
    },
    onMessage(callback) {
      messageCallbacks.add(callback);
      return () => {
        messageCallbacks.delete(callback);
      };
    },
    onStatus(callback) {
      statusCallbacks.add(callback);
      return () => {
        statusCallbacks.delete(callback);
      };
    },
    tick,
  };
}
```

- [ ] **Step 5: 运行确认通过**

Run: `node --import tsx --test src/hmi/data/mock-source.test.ts`
Expected: PASS（2 tests）。

- [ ] **Step 6: Commit**

```bash
git add src/hmi/data/data-source.ts src/hmi/data/mock-source.ts src/hmi/data/mock-source.test.ts
git commit -m "feat(hmi): DataSource interface and mock simulator source"
```

---

## Task 6: MQTT 数据源（mqtt.js 包装，依赖注入可测）

**Files:**
- Create: `src/hmi/data/mqtt-client.ts`
- Test: `src/hmi/data/mqtt-client.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/data/mqtt-client.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodePayload, createMqttSource, type MqttLike } from "./mqtt-client";

describe("decodePayload", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it("解析 JSON 对象", () => {
    assert.deepEqual(decodePayload(enc('{"a":1}')), { a: 1 });
  });
  it("非 JSON 数字转 number", () => {
    assert.equal(decodePayload(enc("17.2")), 17.2);
  });
  it("非 JSON 文本保留字符串", () => {
    assert.equal(decodePayload(enc("RUN")), "RUN");
  });
});

/** 可控的假 mqtt 客户端，捕获事件处理器供测试触发。 */
function makeFakeClient() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const subscribed: string[] = [];
  const client: MqttLike = {
    on(event, cb) {
      (handlers[event] ??= []).push(cb as (...args: unknown[]) => void);
    },
    subscribe(topic) {
      subscribed.push(...(Array.isArray(topic) ? topic : [topic]));
    },
    end() {
      handlers["close"]?.forEach((cb) => cb());
    },
  };
  const emit = (event: string, ...args: unknown[]) =>
    handlers[event]?.forEach((cb) => cb(...args));
  return { client, emit, subscribed };
}

describe("createMqttSource", () => {
  it("connect 后 on('connect') → connected 且订阅 topics", () => {
    const fake = makeFakeClient();
    const source = createMqttSource({
      url: "ws://x",
      topics: ["t/a", "t/b"],
      connectFn: () => fake.client,
    });
    source.connect();
    assert.equal(source.status, "connecting");
    fake.emit("connect");
    assert.equal(source.status, "connected");
    assert.deepEqual(fake.subscribed, ["t/a", "t/b"]);
  });

  it("message 事件解码后转发", () => {
    const fake = makeFakeClient();
    const source = createMqttSource({
      url: "ws://x",
      topics: ["t/a"],
      connectFn: () => fake.client,
    });
    const got: unknown[] = [];
    source.onMessage((m) => got.push(m));
    source.connect();
    fake.emit("message", "t/a", new TextEncoder().encode('{"v":1}'));
    assert.deepEqual(got, [{ topic: "t/a", payload: { v: 1 } }]);
  });

  it("error 事件 → status error", () => {
    const fake = makeFakeClient();
    const source = createMqttSource({
      url: "ws://x",
      topics: [],
      connectFn: () => fake.client,
    });
    source.connect();
    fake.emit("error", new Error("boom"));
    assert.equal(source.status, "error");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --import tsx --test src/hmi/data/mqtt-client.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 mqtt-client.ts**

`src/hmi/data/mqtt-client.ts`:
```ts
import mqtt from "mqtt";
import type { ConnectionStatus, DataMessage, DataSource } from "./data-source";

/** mqtt.js 客户端的最小类型面（便于注入假实现）。 */
export interface MqttLike {
  on(event: "connect", cb: () => void): void;
  on(event: "message", cb: (topic: string, payload: Uint8Array) => void): void;
  on(event: "error", cb: (error: Error) => void): void;
  on(event: "close", cb: () => void): void;
  subscribe(topic: string | string[]): void;
  end(): void;
}

export type MqttConnect = (url: string) => MqttLike;

export interface MqttSourceOptions {
  readonly url: string;
  readonly topics: readonly string[];
  /** 注入点：默认用 mqtt.connect；测试传假实现。 */
  readonly connectFn?: MqttConnect;
}

/** 解码 mqtt payload：优先 JSON，其次 number，最后原始字符串。 */
export function decodePayload(payload: Uint8Array): unknown {
  const text = new TextDecoder().decode(payload);
  try {
    return JSON.parse(text);
  } catch {
    const asNumber = Number(text);
    return text.trim() !== "" && !Number.isNaN(asNumber) ? asNumber : text;
  }
}

const defaultConnect: MqttConnect = (url) =>
  mqtt.connect(url) as unknown as MqttLike;

export function createMqttSource(options: MqttSourceOptions): DataSource {
  const connectFn = options.connectFn ?? defaultConnect;
  let status: ConnectionStatus = "disconnected";
  let client: MqttLike | null = null;
  const messageCallbacks = new Set<(message: DataMessage) => void>();
  const statusCallbacks = new Set<(status: ConnectionStatus) => void>();

  const setStatus = (next: ConnectionStatus) => {
    status = next;
    statusCallbacks.forEach((callback) => callback(next));
  };

  return {
    get status() {
      return status;
    },
    connect() {
      setStatus("connecting");
      client = connectFn(options.url);
      client.on("connect", () => {
        if (options.topics.length > 0) {
          client?.subscribe([...options.topics]);
        }
        setStatus("connected");
      });
      client.on("message", (topic, payload) => {
        const message: DataMessage = { topic, payload: decodePayload(payload) };
        messageCallbacks.forEach((callback) => callback(message));
      });
      client.on("error", () => setStatus("error"));
      client.on("close", () => setStatus("disconnected"));
    },
    disconnect() {
      client?.end();
      client = null;
      setStatus("disconnected");
    },
    onMessage(callback) {
      messageCallbacks.add(callback);
      return () => {
        messageCallbacks.delete(callback);
      };
    },
    onStatus(callback) {
      statusCallbacks.add(callback);
      return () => {
        statusCallbacks.delete(callback);
      };
    },
  };
}
```

> 说明：mqtt.js 自带断线自动重连，无需手写退避；`close`/`connect` 事件会自然驱动 status 在 `disconnected`↔`connected` 间切换。

- [ ] **Step 4: 运行确认通过**

Run: `node --import tsx --test src/hmi/data/mqtt-client.test.ts`
Expected: PASS（6 tests）。

- [ ] **Step 5: 全量测试 + lint**

Run: `npm test`
Expected: 所有 `src/hmi/**/*.test.ts` 通过。

Run: `npm run lint`
Expected: 无 error（如 lint 对 `src/hmi` 报未用变量等，按提示修正）。

- [ ] **Step 6: Commit**

```bash
git add src/hmi/data/mqtt-client.ts src/hmi/data/mqtt-client.test.ts
git commit -m "feat(hmi): mqtt-over-ws data source with injectable client"
```

---

## 完成标准（计划A Done）

- `src/hmi/{schema,data,scene}` 全部模块就位，`npm test` 全绿。
- schema 经 zod 校验、绑定支持 JSONPath、tag-store 不可变可订阅、scene 状态解析正确、mock 与 mqtt 两个数据源同接口可用。
- 零 UI / 零 Canvas 依赖——计划B（引擎+图元）、计划C（页面集成）将在此之上构建。

## Self-Review 记录

- **Spec 覆盖**：§6 Schema→Task1；§8 校验/失联→Task1/4/6；JSONPath→Task2；单连接多 topic→Task6（topics 数组订阅）；mock 兜底→Task5；tag-store→Task3。状态语言(§3)的视觉部分属计划B，本计划只产出 `NodeState`(running/fault/stale) 供其消费。
- **占位符**：无 TBD/TODO；每步含完整代码与命令。
- **类型一致**：`Binding/MimicNode/Mimic` 定义于 Task1，被 Task2/4 复用；`DataSource/DataMessage/ConnectionStatus` 定义于 Task5，被 Task5/6 复用；`getPayload: (topic)=>unknown` 签名在 binding 与 scene 间一致。
