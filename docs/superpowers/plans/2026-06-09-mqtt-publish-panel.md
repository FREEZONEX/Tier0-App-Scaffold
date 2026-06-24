# MQTT 发布面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 HMI 加手动 MQTT 发布：选中设备 → 检视面板下方填 topic + JSON payload → 直接 publish；可为 topic 存 JSON 模板预填。

**Architecture:** 数据层 `DataSource` 加 `publish` → `HmiPage` 把 source 提升到 ref → `Inspector` 内嵌 `PublishPanel` 调发送。mqtt 真发、mock 回显。发布预设存节点 schema。

**Tech Stack:** TanStack Start / React 19、mqtt.js、zod、node:test、Playwright、Tailwind 4、lucide-react。

**Spec:** `docs/superpowers/specs/2026-06-09-mqtt-publish-panel-design.md`

---

## 关键参考

- **`DataSource` 接口** `src/hmi/data/data-source.ts`：`connect/disconnect/onMessage/onStatus/status`，加 `publish`。
- **mqtt 注入测试**：`createMqttSource({ url, topics, connectFn })`，`connectFn` 返回 `MqttLike` 假实现；`on("connect", cb)` 里 `cb()` 立即触发已连接。
- **mock**：`createMockSource(specs)` 返回 `MockSource`，纯对象实现 DataSource。
- **edit.ts `mapNode`**：`mapNode(mimic, nodeId, fn)` 不可变改单节点。
- **Inspector 挂载点**：`Inspector.tsx` 渲染顺序 = 标题 → 实时数据 → 趋势 → `BindingEditor`(line 128) → 删除按钮(line 143)；PublishPanel 插在 BindingEditor 块之后、删除按钮之前。
- **HmiPage source effect**：`HmiPage.tsx:91-106` 创建 source 为 effect 局部变量；提升到 `useRef`。
- **测试**：node:test，`node --import tsx --test <file>`。
- **UI 风格**：参照 `Topbar.tsx`/`MimicTitle.tsx`（Tailwind，`rounded-sm border border-border`，lucide 图标，`useT()`）。

---

## File Structure

- **Modify** `src/hmi/data/data-source.ts` — `DataSource` 加 `publish`
- **Modify** `src/hmi/data/mock-source.ts` — 实现 `publish`（console 回显）
- **Create** `src/hmi/data/mock-source.test.ts` — mock publish 测试
- **Modify** `src/hmi/data/mqtt-client.ts` — `MqttLike` + `createMqttSource` 加 `publish`
- **Create** `src/hmi/data/mqtt-client.test.ts` — mqtt publish 测试
- **Modify** `src/hmi/schema/schema.ts` — `nodeSchema` 加 `publishPresets`
- **Modify** `src/hmi/schema/edit.ts` — `setNodePublishPreset` / `removeNodePublishPreset`
- **Modify** `src/hmi/schema/edit.test.ts` — preset 编辑测试
- **Create** `src/hmi/components/PublishPanel.tsx` — 发布 UI
- **Modify** `src/hmi/components/Inspector.tsx` — 挂 PublishPanel + props
- **Modify** `src/hmi/components/HmiPage.tsx` — source ref + 回调接线
- **Modify** `src/hmi/i18n/dict.ts` — 新词条
- **Modify** `e2e/hmi.spec.ts` — 发布流程 E2E

---

## Task 1: DataSource.publish 接口 + mock 实现

**Files:**
- Modify: `src/hmi/data/data-source.ts`
- Modify: `src/hmi/data/mock-source.ts`
- Create: `src/hmi/data/mock-source.test.ts`

- [ ] **Step 1: 写失败测试 `mock-source.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockSource } from "./mock-source";

describe("mock-source publish", () => {
  it("publish 不真发、不抛错（mock 回显）", () => {
    const src = createMockSource([]);
    assert.equal(typeof src.publish, "function");
    assert.doesNotThrow(() => src.publish("cmd/pump-101", { run: true }));
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --import tsx --test src/hmi/data/mock-source.test.ts`
Expected: FAIL（`src.publish` 不是函数）

- [ ] **Step 3: 接口 + 实现**

`data-source.ts` 的 `DataSource` 接口加（在 `status` 前）：
```ts
  /** 发布一条消息（控制/操作下发）。mqtt 真发，mock 回显。 */
  publish(topic: string, payload: unknown): void;
```

`mock-source.ts` 的 return 对象加（在 `tick` 前）：
```ts
    publish(topic: string, payload: unknown) {
      // mock 模式不连真 broker，回显便于开发时确认发了什么
      // eslint-disable-next-line no-console
      console.log("[mock publish]", topic, payload);
    },
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --import tsx --test src/hmi/data/mock-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hmi/data/data-source.ts src/hmi/data/mock-source.ts src/hmi/data/mock-source.test.ts
git commit -m "feat(hmi): DataSource.publish 接口 + mock 回显实现"
```

---

## Task 2: mqtt-client publish

**Files:**
- Modify: `src/hmi/data/mqtt-client.ts`
- Create: `src/hmi/data/mqtt-client.test.ts`

- [ ] **Step 1: 写失败测试 `mqtt-client.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMqttSource, type MqttLike } from "./mqtt-client";

function fakeClient(calls: Array<{ topic: string; msg: string; opts: unknown }>): MqttLike {
  return {
    on(event: string, cb: (...args: never[]) => void) {
      if (event === "connect") (cb as () => void)(); // 立即视为已连接
    },
    subscribe() {},
    publish(topic: string, msg: string, opts?: unknown) {
      calls.push({ topic, msg, opts });
    },
    end() {},
  } as unknown as MqttLike;
}

describe("mqtt-client publish", () => {
  it("已连接：转发到 client.publish（JSON 串 + qos1 不 retain）", () => {
    const calls: Array<{ topic: string; msg: string; opts: unknown }> = [];
    const src = createMqttSource({ url: "ws://x", topics: [], connectFn: () => fakeClient(calls) });
    src.connect();
    src.publish("cmd/pump-101", { run: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].topic, "cmd/pump-101");
    assert.equal(calls[0].msg, JSON.stringify({ run: true }));
    assert.deepEqual(calls[0].opts, { qos: 1, retain: false });
  });

  it("未连接：不调 client.publish，状态转 error", () => {
    const calls: Array<{ topic: string; msg: string; opts: unknown }> = [];
    const src = createMqttSource({ url: "ws://x", topics: [], connectFn: () => fakeClient(calls) });
    let lastStatus = "";
    src.onStatus((s) => { lastStatus = s; });
    src.publish("cmd/x", { a: 1 }); // 没 connect
    assert.equal(calls.length, 0);
    assert.equal(lastStatus, "error");
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --import tsx --test src/hmi/data/mqtt-client.test.ts`
Expected: FAIL（`src.publish` 未定义）

- [ ] **Step 3: 实现**

`mqtt-client.ts` 的 `MqttLike` 接口加（在 `subscribe` 后）：
```ts
  publish(topic: string, message: string, opts?: { qos?: 0 | 1 | 2; retain?: boolean }): void;
```

`createMqttSource` 的 return 对象加（在 `disconnect` 后）：
```ts
    publish(topic: string, payload: unknown) {
      if (!client) {
        setStatus("error", new Error("未连接，无法发送"));
        return;
      }
      // 控制命令：qos 1 至少一次、不 retain（命令不应被 broker 留存重放）
      client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
    },
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --import tsx --test src/hmi/data/mqtt-client.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add src/hmi/data/mqtt-client.ts src/hmi/data/mqtt-client.test.ts
git commit -m "feat(hmi): mqtt-client publish（qos1 不 retain，未连接报错）"
```

---

## Task 3: schema publishPresets + edit

**Files:**
- Modify: `src/hmi/schema/schema.ts`
- Modify: `src/hmi/schema/edit.ts`
- Modify: `src/hmi/schema/edit.test.ts`

- [ ] **Step 1: schema 加字段**

`schema.ts` 的 `nodeSchema` 里，`props` 字段之后加：
```ts
  /** MQTT 发布预设：topic → payload 的 JSON 模板字符串（手动发布面板预填用）。 */
  publishPresets: z
    .array(z.object({ topic: z.string().min(1), template: z.string() }))
    .optional(),
```

- [ ] **Step 2: 写失败测试（追加到 `edit.test.ts`）**

顶部 import 加 `setNodePublishPreset, removeNodePublishPreset`，追加：
```ts
describe("publishPresets 编辑", () => {
  const base = mimicSchema.parse({
    meta: { name: "t" },
    nodes: [{ id: "P-1", type: "pump", x: 0, y: 0 }],
  });

  it("setNodePublishPreset 新增", () => {
    const next = setNodePublishPreset(base, "P-1", "cmd/p1", '{"run":true}');
    assert.deepEqual(next.nodes[0].publishPresets, [{ topic: "cmd/p1", template: '{"run":true}' }]);
    assert.equal(base.nodes[0].publishPresets, undefined); // 不变原
  });

  it("setNodePublishPreset 同 topic 替换", () => {
    const a = setNodePublishPreset(base, "P-1", "cmd/p1", "{}");
    const b = setNodePublishPreset(a, "P-1", "cmd/p1", '{"run":false}');
    assert.equal(b.nodes[0].publishPresets?.length, 1);
    assert.equal(b.nodes[0].publishPresets?.[0].template, '{"run":false}');
  });

  it("removeNodePublishPreset 删除", () => {
    const a = setNodePublishPreset(base, "P-1", "cmd/p1", "{}");
    const b = removeNodePublishPreset(a, "P-1", "cmd/p1");
    assert.deepEqual(b.nodes[0].publishPresets, []);
  });
});
```

（确认 `edit.test.ts` 顶部已 import `mimicSchema`；没有则加 `import { mimicSchema } from "./schema";`）

- [ ] **Step 3: 跑测试，确认失败**

Run: `node --import tsx --test src/hmi/schema/edit.test.ts`
Expected: FAIL（函数未定义）

- [ ] **Step 4: 实现（`edit.ts`，加在 `setNodeLabel` 后）**

```ts
/** 不可变 upsert 发布预设（按 topic 替换或追加）。 */
export function setNodePublishPreset(mimic: Mimic, nodeId: string, topic: string, template: string): Mimic {
  return mapNode(mimic, nodeId, (node) => {
    const presets = node.publishPresets ?? [];
    const idx = presets.findIndex((p) => p.topic === topic);
    const next =
      idx >= 0
        ? presets.map((p, i) => (i === idx ? { topic, template } : p))
        : [...presets, { topic, template }];
    return { ...node, publishPresets: next };
  });
}

/** 不可变删除某 topic 的发布预设。 */
export function removeNodePublishPreset(mimic: Mimic, nodeId: string, topic: string): Mimic {
  return mapNode(mimic, nodeId, (node) =>
    node.publishPresets
      ? { ...node, publishPresets: node.publishPresets.filter((p) => p.topic !== topic) }
      : node,
  );
}
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `node --import tsx --test src/hmi/schema/edit.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hmi/schema/schema.ts src/hmi/schema/edit.ts src/hmi/schema/edit.test.ts
git commit -m "feat(hmi): schema publishPresets + edit upsert/remove"
```

---

## Task 4: PublishPanel 组件 + i18n

**Files:**
- Create: `src/hmi/components/PublishPanel.tsx`
- Modify: `src/hmi/i18n/dict.ts`

- [ ] **Step 1: 加 i18n 词条（`dict.ts`，在「图纸标题 / 重命名」块后）**

```ts
  // ── MQTT 发布面板 ──
  "MQTT 发布": "MQTT publish",
  "发送": "Send",
  "存为模板": "Save as template",
  "删除模板": "Delete template",
  "主题 topic": "Topic",
  "消息 payload": "Payload",
  "手填主题": "Custom topic…",
  "JSON 格式错误": "Invalid JSON",
```

- [ ] **Step 2: 写 `PublishPanel.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Send, Save, Trash2 } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import type { MimicNode } from "@/hmi/schema/schema";

interface PublishPanelProps {
  node: MimicNode;
  onPublish: (topic: string, payload: unknown) => void;
  onSavePreset: (topic: string, template: string) => void;
  onRemovePreset: (topic: string) => void;
}

const MANUAL = "__manual__";

export function PublishPanel({ node, onPublish, onSavePreset, onRemovePreset }: PublishPanelProps) {
  const t = useT();
  const presets = node.publishPresets ?? [];
  const topicOptions = Array.from(new Set([...node.topics, ...presets.map((p) => p.topic)]));
  const [topicSel, setTopicSel] = useState<string>(topicOptions[0] ?? MANUAL);
  const [manualTopic, setManualTopic] = useState("");
  const [payload, setPayload] = useState("{}");

  const topic = topicSel === MANUAL ? manualTopic.trim() : topicSel;

  // 选预设 topic 时预填模板（有则填 template，无则空对象）
  useEffect(() => {
    if (topicSel === MANUAL) return;
    const preset = presets.find((p) => p.topic === topicSel);
    setPayload(preset ? preset.template : "{}");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicSel]);

  let parsed: unknown;
  let jsonValid = true;
  try {
    parsed = JSON.parse(payload);
  } catch {
    jsonValid = false;
  }

  const hasPreset = topic !== "" && presets.some((p) => p.topic === topic);

  return (
    <div className="mt-4" data-testid="publish-panel">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("MQTT 发布")}</p>

      <select
        value={topicSel}
        onChange={(e) => setTopicSel(e.target.value)}
        aria-label={t("主题 topic")}
        data-testid="publish-topic"
        className="mb-1.5 h-7 w-full rounded-sm border border-border bg-background px-2 text-xs text-foreground"
      >
        {topicOptions.map((tp) => (
          <option key={tp} value={tp}>{tp}</option>
        ))}
        <option value={MANUAL}>{t("手填主题")}</option>
      </select>

      {topicSel === MANUAL ? (
        <input
          value={manualTopic}
          onChange={(e) => setManualTopic(e.target.value)}
          placeholder={t("主题 topic")}
          aria-label={t("主题 topic")}
          className="mb-1.5 h-7 w-full rounded-sm border border-border bg-background px-2 text-xs text-foreground"
        />
      ) : null}

      <textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        rows={4}
        aria-label={t("消息 payload")}
        data-testid="publish-payload"
        className="w-full resize-y rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-highlight-text"
      />
      {!jsonValid ? <p className="mt-0.5 text-[10px] text-destructive">{t("JSON 格式错误")}</p> : null}

      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          disabled={!jsonValid || !topic}
          onClick={() => onPublish(topic, parsed)}
          data-testid="publish-send"
          className="flex items-center gap-1 rounded-sm bg-foreground px-2 py-1 text-xs text-background disabled:opacity-40"
        >
          <Send className="size-3" /> {t("发送")}
        </button>
        <button
          type="button"
          disabled={!topic}
          onClick={() => onSavePreset(topic, payload)}
          className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Save className="size-3" /> {t("存为模板")}
        </button>
        {hasPreset ? (
          <button
            type="button"
            onClick={() => onRemovePreset(topic)}
            aria-label={t("删除模板")}
            title={t("删除模板")}
            className="flex items-center rounded-sm border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证类型**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/hmi/components/PublishPanel.tsx src/hmi/i18n/dict.ts
git commit -m "feat(hmi): PublishPanel 组件（topic 下拉 + JSON 编辑 + 发送 + 存模板）+ i18n"
```

---

## Task 5: HmiPage source ref + Inspector 集成

**Files:**
- Modify: `src/hmi/components/HmiPage.tsx`
- Modify: `src/hmi/components/Inspector.tsx`

- [ ] **Step 1: HmiPage 提升 source 到 ref + 回调**

`HmiPage.tsx`：
- import 改：`import type { ConnectionStatus, DataSource } from "@/hmi/data/data-source";`
- edit import 加 `setNodePublishPreset, removeNodePublishPreset`：
  `import { setNodeBinding, setNodeLabel, setMimicName, setNodePublishPreset, removeNodePublishPreset, addNodeTopic, removeNodeTopic, moveNodesBy, addNode, removeNodes, addNodeWatch, removeNodeWatch } from "@/hmi/schema/edit";`
- 在 `useRef` 已 import 的前提下，组件内（`const [tool...]` 附近）加：
  ```ts
  const sourceRef = useRef<DataSource | null>(null);
  ```
- 改 source effect（line 91-106）赋值/清空 ref：
  ```ts
  useEffect(() => {
    if (!connected) return;
    const source =
      sourceMode === "live"
        ? createMqttSource({ url: schema.broker?.url ?? "", topics: schemaTopics(schema) })
        : createMockSource(mockSpecsFromSchema(schema));
    sourceRef.current = source;
    const offMsg = source.onMessage((m) => tagStore.setMessage(m.topic, m.payload));
    const offStatus = source.onStatus(setStatus);
    source.connect();
    return () => {
      offMsg();
      offStatus();
      source.disconnect();
      sourceRef.current = null;
      setStatus("disconnected");
    };
  }, [connected, sourceMode, schema, tagStore]);
  ```

- [ ] **Step 2: HmiPage 把回调传给 Inspector**

找到渲染 `<Inspector` 的地方（`selectedNode` 存在时），在现有 props 后加：
```tsx
              onPublish={(topic, payload) => sourceRef.current?.publish(topic, payload)}
              onSavePreset={(topic, template) => history.commit((s) => setNodePublishPreset(s, selectedNode.id, topic, template))}
              onRemovePreset={(topic) => history.commit((s) => removeNodePublishPreset(s, selectedNode.id, topic))}
```

- [ ] **Step 3: Inspector 加 props + 渲染 PublishPanel**

`Inspector.tsx`：
- import 加：`import { PublishPanel } from "./PublishPanel";`
- props 解构加 `onPublish, onSavePreset, onRemovePreset`；类型块加：
  ```ts
    onPublish: (topic: string, payload: unknown) => void;
    onSavePreset: (topic: string, template: string) => void;
    onRemovePreset: (topic: string) => void;
  ```
- 在删除按钮（`data-testid="inspector-delete"` 那个 `<button>`）**之前**插入：
  ```tsx
        <PublishPanel
          node={node}
          onPublish={onPublish}
          onSavePreset={onSavePreset}
          onRemovePreset={onRemovePreset}
        />
  ```

- [ ] **Step 4: 全量校验**

Run: `npx tsc --noEmit && npm run lint`
Expected: 均无错误

Run: `npm test`
Expected: 全过（含 Task 1-3 新测试）

- [ ] **Step 5: 浏览器实测**

起 `npm run dev:preview`，点选一个设备 → 检视面板下方出现「MQTT 发布」：
- 选 topic（下拉该设备的）→ payload 预填 `{}`
- 改成 `{"run":true}` → 点「发送」→ mock 模式下 F12 console 有 `[mock publish] <topic> {run:true}`
- 点「存为模板」→ 重选该 topic → payload 自动预填刚存的模板
- payload 改成非法 JSON → 报「JSON 格式错误」+ 发送禁用
截图确认。

- [ ] **Step 6: Commit**

```bash
git add src/hmi/components/HmiPage.tsx src/hmi/components/Inspector.tsx
git commit -m "feat(hmi): 检视面板接入 MQTT 发布（source ref + 预设回调）"
```

---

## Task 6: 发布流程 E2E

**Files:**
- Modify: `e2e/hmi.spec.ts`

- [ ] **Step 1: 加 E2E 用例**

按 `e2e/hmi.spec.ts` 现有写法（参照首个用例的「点画布命中设备开 Inspector」扫描点击）追加：
```ts
test("MQTT 发布面板：选 topic、改 payload、发送（mock）", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByTestId("hmi-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  // 扫描点击命中一个设备，开 Inspector
  for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    await canvas.click({ position: { x: box.width * fx, y: box.height / 2 } });
    if (await page.getByTestId("inspector").isVisible()) break;
  }
  await expect(page.getByTestId("inspector")).toBeVisible();

  // 发布面板可见
  const panel = page.getByTestId("publish-panel");
  await expect(panel).toBeVisible();

  // 非法 JSON → 发送禁用
  await panel.getByTestId("publish-payload").fill("{ bad");
  await expect(panel.getByTestId("publish-send")).toBeDisabled();

  // 合法 JSON → 发送可点（不校验真发，mock 回显在 console）
  await panel.getByTestId("publish-payload").fill('{"run":true}');
  await expect(panel.getByTestId("publish-send")).toBeEnabled();
  await panel.getByTestId("publish-send").click();
  // 画布未崩
  await expect(canvas).toBeVisible();
});
```

- [ ] **Step 2: 跑 E2E**

Run: `npm run e2e`
Expected: 新用例通过（既有失败用例属 i18n 语言问题，非本次引入）

- [ ] **Step 3: Commit**

```bash
git add e2e/hmi.spec.ts
git commit -m "test(hmi): MQTT 发布面板 E2E（选设备→改 payload→发送）"
```

---

## 收尾验证清单

- [ ] `npx tsc --noEmit` 干净
- [ ] `npm test` 全过（mock/mqtt publish + edit preset 新测试）
- [ ] `npm run lint` 干净（mock 的 console.log 已 eslint-disable）
- [ ] `dev:preview` 实测：发送 mock 回显、存模板预填、非法 JSON 禁发送、EN 下新串已翻译
- [ ] 现有监控未回归（连接/断开/数据刷新 E2E 通过）
