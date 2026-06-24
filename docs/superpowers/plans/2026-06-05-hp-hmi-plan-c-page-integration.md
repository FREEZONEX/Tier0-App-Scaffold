# HP-HMI 计划C — 页面集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把计划A 数据层 + 计划B 引擎/图元层装配成一个可在浏览器运行的 HP-HMI 页面：加载 schema → Canvas 渲染 → mock 数据驱动动态 → 点图元开停靠 Inspector 看详情/改绑定 → 顶栏控制 MQTT 连接 + 主题切换。

**Architecture:** 独立全屏路由 `/hmi`（自带 auth，不套 MonitorLayout，避免顶栏冲突）。`HmiPage` 持有 schema/selectedId/themeMode/连接态，创建唯一 `tagStore` 与 `DataSource`（默认 mock，可切 mqtt）。`HmiCanvas` 用 ref 管理 stage/loop/viewport，每帧 `renderScene` 并 `stage.draw`，数据变化经 `tagStore.subscribe → loop.markDirty` 触发重绘，点击经 `hitTest` 回选中。Inspector 订阅 tagStore 显示选中节点实时值并编辑绑定（不可变回写 schema）。纯逻辑 TDD 单测；React 组件与画布集成用 Playwright E2E 验证。

**Tech Stack:** React 19, TanStack Start/Router, Tailwind 4 (tier0 tokens), Canvas 2D, `node:test`+tsx（纯逻辑）, Playwright（E2E）。

参考：spec `docs/superpowers/specs/2026-06-05-hp-hmi-mimic-template-design.md`；计划B 终审给 C 的建议（tagStore→markDirty、scene bbox、theme token、慢闪周期等）。

依赖：计划A（schema/scene/tag-store/binding/data-source/mock-source/mqtt-client/edge-flow）、计划B（engine/* + symbols/*）。

---

## 文件结构（本计划产出）

```
src/hmi/
  scene/scene-bounds.ts          # sceneBounds(scene, registry) 全场景包围盒（fit 用）
  scene/scene-bounds.test.ts
  schema/edit.ts                 # 不可变 schema 编辑（Inspector 用）
  schema/edit.test.ts
  data/mock-spec.ts              # mockSpecsFromSchema(mimic) → MockTopicSpec[]
  data/mock-spec.test.ts
  symbols/default-registry.ts    # 集中注册 tank/pump/valve/meter
  components/
    HmiCanvas.tsx                # canvas 挂载 + 渲染循环 + 命中
    Topbar.tsx ConnectionControl.tsx ThemeToggle.tsx
    Inspector.tsx TopicBindingEditor.tsx
    HmiPage.tsx                  # 装配（state + 数据 + 三区布局）
src/routes/hmi.tsx               # 全屏路由 + auth
public/schemas/default.json      # 内置示例工艺图（罐→阀→泵→流量计）
playwright.config.ts             # E2E 配置
e2e/hmi.spec.ts                  # E2E 主流程
```

约定：`src/hmi` 引擎/纯逻辑内部仍用相对导入；React 组件可用 `@/hmi/...` 别名（Vite 解析）。React 组件不写单测（项目无 React 单测设施），由 E2E 覆盖；纯逻辑全 TDD。

---

## Task 1: 全场景包围盒

**Files:** Create `src/hmi/scene/scene-bounds.ts` + `.test.ts`

- [ ] **Step 1: 写失败测试** — `src/hmi/scene/scene-bounds.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sceneBounds } from "./scene-bounds";
import { buildScene } from "./scene";
import { parseMimic } from "../schema/schema";
import { createRegistry, type SymbolDef } from "../symbols/registry";

const box20: SymbolDef = {
  type: "b",
  build: () => [],
  bounds: (node) => ({ x: node.x - 10, y: node.y - 10, w: 20, h: 20 }),
};
const reg = createRegistry([box20]);
const scene = buildScene(parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "a", type: "b", x: 0, y: 0, topics: [], bindings: {} },
    { id: "c", type: "b", x: 100, y: 50, topics: [], bindings: {} },
  ],
  edges: [],
}).data!);

describe("sceneBounds", () => {
  it("求所有节点 bounds 的并集", () => {
    const box = sceneBounds(scene, reg);
    assert.equal(box.x, -10);
    assert.equal(box.y, -10);
    assert.equal(box.w, 120); // -10 .. 110
    assert.equal(box.h, 70); // -10 .. 60
  });
  it("空场景返回零盒", () => {
    const empty = buildScene(parseMimic({ meta: { name: "x", version: 1 }, nodes: [], edges: [] }).data!);
    assert.deepEqual(sceneBounds(empty, reg), { x: 0, y: 0, w: 0, h: 0 });
  });
});
```

- [ ] **Step 2: 运行确认失败** — `node --import tsx --test src/hmi/scene/scene-bounds.test.ts`

- [ ] **Step 3: 实现** — `src/hmi/scene/scene-bounds.ts`:
```ts
import type { Scene } from "./scene";
import type { Registry } from "../symbols/registry";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 所有节点 bounds 的并集，用于 viewport.fit。空场景返回零盒。 */
export function sceneBounds(scene: Scene, registry: Registry): Box {
  if (scene.nodes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of scene.nodes) {
    const b = registry.get(node.type).bounds(node);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
```

- [ ] **Step 4: 运行确认通过**（2 tests）。
- [ ] **Step 5: Commit** — `git add src/hmi/scene/scene-bounds.ts src/hmi/scene/scene-bounds.test.ts && git commit -m "feat(hmi): whole-scene bounding box for fit"`

---

## Task 2: 不可变 schema 编辑

**Files:** Create `src/hmi/schema/edit.ts` + `.test.ts`

- [ ] **Step 1: 写失败测试** — `src/hmi/schema/edit.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setNodeTopics, setNodeBinding } from "./edit";
import { parseMimic, type Mimic } from "./schema";

const base: Mimic = parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [{ id: "P-01", type: "pump", x: 0, y: 0, topics: ["t/a"], bindings: { running: { topic: "t/a", path: "s" } } }],
  edges: [],
}).data!;

describe("setNodeTopics (不可变)", () => {
  it("替换指定节点的 topics，返回新对象，原对象不变", () => {
    const next = setNodeTopics(base, "P-01", ["t/a", "t/b"]);
    assert.deepEqual(next.nodes[0].topics, ["t/a", "t/b"]);
    assert.deepEqual(base.nodes[0].topics, ["t/a"]);
    assert.notEqual(next, base);
    assert.notEqual(next.nodes[0], base.nodes[0]);
  });
  it("未知节点 id：原样返回", () => {
    assert.equal(setNodeTopics(base, "NOPE", ["x"]), base);
  });
});

describe("setNodeBinding (不可变)", () => {
  it("设置某属性绑定", () => {
    const next = setNodeBinding(base, "P-01", "rpm", { topic: "t/b", path: "rpm" });
    assert.deepEqual(next.nodes[0].bindings.rpm, { topic: "t/b", path: "rpm" });
    assert.equal(base.nodes[0].bindings.rpm, undefined);
  });
});
```

- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现** — `src/hmi/schema/edit.ts`:
```ts
import type { Mimic, MimicNode, Binding } from "./schema";

function mapNode(mimic: Mimic, nodeId: string, fn: (node: MimicNode) => MimicNode): Mimic {
  let changed = false;
  const nodes = mimic.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    changed = true;
    return fn(node);
  });
  return changed ? { ...mimic, nodes } : mimic;
}

/** 不可变替换节点 topics。未知 id 原样返回。 */
export function setNodeTopics(mimic: Mimic, nodeId: string, topics: string[]): Mimic {
  return mapNode(mimic, nodeId, (node) => ({ ...node, topics: [...topics] }));
}

/** 不可变设置节点某属性的绑定。 */
export function setNodeBinding(mimic: Mimic, nodeId: string, key: string, binding: Binding): Mimic {
  return mapNode(mimic, nodeId, (node) => ({
    ...node,
    bindings: { ...node.bindings, [key]: { ...binding } },
  }));
}
```

- [ ] **Step 4: 运行确认通过**（3 tests）。
- [ ] **Step 5: Commit** — `git add src/hmi/schema/edit.ts src/hmi/schema/edit.test.ts && git commit -m "feat(hmi): immutable schema edit helpers"`

---

## Task 3: Mock 数据生成器

**Files:** Create `src/hmi/data/mock-spec.ts` + `.test.ts`

- [ ] **Step 1: 写失败测试** — `src/hmi/data/mock-spec.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockSpecsFromSchema } from "./mock-spec";
import { parseMimic } from "../schema/schema";

const mimic = parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "TK-01", type: "tank", x: 0, y: 0, topics: ["t/level"], bindings: { level: { topic: "t/level", path: "level" } } },
    { id: "P-01", type: "pump", x: 0, y: 0, topics: ["t/pump"], bindings: { running: { topic: "t/pump", path: "running" } } },
  ],
  edges: [{ id: "e", from: "TK-01", to: "P-01", points: [[0, 0], [1, 1]], flowBy: { topic: "t/flow", path: "flow" } }],
}).data!;

describe("mockSpecsFromSchema", () => {
  it("为每个唯一 topic 生成一个 spec（含 edge.flowBy 的 topic）", () => {
    const specs = mockSpecsFromSchema(mimic);
    const topics = specs.map((s) => s.topic).sort();
    assert.deepEqual(topics, ["t/flow", "t/level", "t/pump"]);
  });
  it("shape(t) 返回带绑定 path 字段的对象", () => {
    const specs = mockSpecsFromSchema(mimic);
    const level = specs.find((s) => s.topic === "t/level")!;
    const payload = level.shape(0) as Record<string, unknown>;
    assert.ok("level" in payload);
    assert.equal(typeof payload.level, "number");
  });
  it("布尔类绑定 path 产出布尔值", () => {
    const specs = mockSpecsFromSchema(mimic);
    const pump = specs.find((s) => s.topic === "t/pump")!;
    const payload = pump.shape(0) as Record<string, unknown>;
    assert.equal(typeof payload.running, "boolean");
  });
});
```

- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现** — `src/hmi/data/mock-spec.ts`:
```ts
import type { Mimic, Binding } from "../schema/schema";
import type { MockTopicSpec } from "./mock-source";

interface Field {
  readonly path: string;
  readonly kind: "number" | "boolean";
}

const BOOL_KEYS = ["running", "open", "fault", "alarm", "manual", "interlock", "on", "active"];

function kindForKey(key: string): "number" | "boolean" {
  return BOOL_KEYS.includes(key.toLowerCase()) ? "boolean" : "number";
}

/** 收集每个 topic 下需要产出的字段（来自节点 bindings 的 key + path，及 edge.flowBy）。 */
function collectFields(mimic: Mimic): Map<string, Field[]> {
  const byTopic = new Map<string, Field[]>();
  const add = (binding: Binding, kind: "number" | "boolean") => {
    const list = byTopic.get(binding.topic) ?? [];
    if (!list.some((f) => f.path === binding.path)) list.push({ path: binding.path, kind });
    byTopic.set(binding.topic, list);
  };
  for (const node of mimic.nodes) {
    for (const [key, binding] of Object.entries(node.bindings)) {
      add(binding, kindForKey(key));
    }
    for (const topic of node.topics) {
      if (!byTopic.has(topic)) byTopic.set(topic, []);
    }
  }
  for (const edge of mimic.edges) {
    if (edge.flowBy) add(edge.flowBy, "number");
  }
  return byTopic;
}

/** 按路径写入嵌套对象（支持 a.b 点路径，简化：仅点路径）。 */
function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const tokens = path.split(".");
  let cur = target;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    if (typeof cur[t] !== "object" || cur[t] === null) cur[t] = {};
    cur = cur[t] as Record<string, unknown>;
  }
  cur[tokens[tokens.length - 1]] = value;
}

/**
 * 从 schema 生成确定性 mock：number 字段走正弦游走，boolean 字段按相位周期翻转。
 * 用每个字段在 topic 内的序号制造相位差，避免所有值同步。
 */
export function mockSpecsFromSchema(mimic: Mimic): MockTopicSpec[] {
  const byTopic = collectFields(mimic);
  const specs: MockTopicSpec[] = [];
  for (const [topic, fields] of byTopic) {
    specs.push({
      topic,
      shape: (t: number) => {
        const payload: Record<string, unknown> = {};
        fields.forEach((field, i) => {
          if (field.kind === "boolean") {
            setPath(payload, field.path, Math.floor((t + i * 3) / 5) % 2 === 0);
          } else {
            const value = 50 + 45 * Math.sin((t + i * 7) / 10);
            setPath(payload, field.path, Math.round(value * 10) / 10);
          }
        });
        return payload;
      },
    });
  }
  return specs;
}
```

- [ ] **Step 4: 运行确认通过**（3 tests）。
- [ ] **Step 5: Commit** — `git add src/hmi/data/mock-spec.ts src/hmi/data/mock-spec.test.ts && git commit -m "feat(hmi): deterministic mock generator from schema"`

---

## Task 4: 默认符号注册表

**Files:** Create `src/hmi/symbols/default-registry.ts`（无单测——纯组合，由 E2E/类型覆盖）

- [ ] **Step 1: 实现** — `src/hmi/symbols/default-registry.ts`:
```ts
import { createRegistry, type Registry } from "./registry";
import { tank } from "./tank";
import { pump } from "./pump";
import { valve } from "./valve";
import { meter } from "./meter";

/** 首切片内置图元集合。后续子项目在此追加。 */
export function createDefaultRegistry(): Registry {
  return createRegistry([tank, pump, valve, meter]);
}
```

- [ ] **Step 2: 类型检查** — `npx tsc --noEmit 2>&1 | grep "src/hmi" || echo "hmi clean"`。
- [ ] **Step 3: Commit** — `git add src/hmi/symbols/default-registry.ts && git commit -m "feat(hmi): default symbol registry"`

---

## Task 5: HmiCanvas 组件

**Files:** Create `src/hmi/components/HmiCanvas.tsx`

- [ ] **Step 1: 实现** — `src/hmi/components/HmiCanvas.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { createCanvasStage, type CanvasStage } from "@/hmi/engine/canvas-stage";
import { createRenderLoop, type RenderLoop } from "@/hmi/engine/render-loop";
import { createViewport, fit, type Viewport } from "@/hmi/engine/viewport";
import { hitTest, type HitBox } from "@/hmi/engine/hit-test";
import { renderScene } from "@/hmi/symbols/scene-render";
import { sceneBounds } from "@/hmi/scene/scene-bounds";
import type { Scene, NodeState } from "@/hmi/scene/scene";
import type { MimicEdge } from "@/hmi/schema/schema";
import type { Registry } from "@/hmi/symbols/registry";
import type { Palette } from "@/hmi/engine/theme";

export interface HmiCanvasProps {
  scene: Scene;
  registry: Registry;
  palette: Palette;
  getState: (nodeId: string) => NodeState;
  isSelected: (nodeId: string) => boolean;
  isEdgeFlowing: (edge: MimicEdge) => boolean;
  hasAnimation: () => boolean;
  /** 注册数据变化监听（如 tagStore.subscribe），返回取消函数。变化时触发重绘。 */
  subscribeData: (listener: () => void) => () => void;
  onSelect: (nodeId: string | null) => void;
}

export function HmiCanvas(props: HmiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<CanvasStage | null>(null);
  const loopRef = useRef<RenderLoop | null>(null);
  const vpRef = useRef<Viewport>(createViewport());
  const hitBoxesRef = useRef<HitBox[]>([]);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const doFit = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const p = propsRef.current;
      vpRef.current = fit(sceneBounds(p.scene, p.registry), stage.size());
    };

    const stage = createCanvasStage(canvas, () => {
      doFit();
      loopRef.current?.markDirty();
    });
    stageRef.current = stage;

    const loop = createRenderLoop({
      render: (phase) => {
        const p = propsRef.current;
        const result = renderScene(p.scene, p.registry, p.getState, p.isSelected, p.palette, p.isEdgeFlowing);
        hitBoxesRef.current = result.hitBoxes;
        stage.draw(result.primitives, vpRef.current, phase);
      },
      hasAnimation: () => propsRef.current.hasAnimation(),
    });
    loopRef.current = loop;

    const offData = propsRef.current.subscribeData(() => loop.markDirty());

    doFit();
    loop.start();
    loop.markDirty();

    return () => {
      offData();
      loop.stop();
      stage.destroy();
    };
  }, []);

  // schema / palette / selection 变化时强制重绘
  useEffect(() => {
    loopRef.current?.markDirty();
  }, [props.scene, props.palette]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const id = hitTest(hitBoxesRef.current, vpRef.current, event.clientX - rect.left, event.clientY - rect.top);
    propsRef.current.onSelect(id);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="block h-full w-full cursor-pointer"
      data-testid="hmi-canvas"
    />
  );
}
```

- [ ] **Step 2: 类型检查** — `npx tsc --noEmit 2>&1 | grep "src/hmi" || echo "hmi clean"`（应 clean）。
- [ ] **Step 3: Commit** — `git add src/hmi/components/HmiCanvas.tsx && git commit -m "feat(hmi): HmiCanvas mounts stage, loop, hit-testing"`

---

## Task 6: 顶栏（连接控制 + 主题切换）

**Files:** Create `src/hmi/components/ThemeToggle.tsx`, `ConnectionControl.tsx`, `Topbar.tsx`

- [ ] **Step 1: ThemeToggle** — `src/hmi/components/ThemeToggle.tsx`:
```tsx
"use client";

import { Sun, Moon } from "lucide-react";
import type { ThemeMode } from "@/hmi/engine/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ mode, onChange }: { mode: ThemeMode; onChange: (m: ThemeMode) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-border" role="group" aria-label="主题切换">
      <button
        type="button"
        onClick={() => onChange("light")}
        aria-pressed={mode === "light"}
        className={cn("flex items-center px-2 py-1", mode === "light" ? "bg-foreground text-background" : "bg-card text-muted-foreground")}
      >
        <Sun className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("dark")}
        aria-pressed={mode === "dark"}
        className={cn("flex items-center px-2 py-1", mode === "dark" ? "bg-foreground text-background" : "bg-card text-muted-foreground")}
      >
        <Moon className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: ConnectionControl** — `src/hmi/components/ConnectionControl.tsx`:
```tsx
"use client";

import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/hmi/data/data-source";

const LABEL: Record<ConnectionStatus, string> = {
  disconnected: "未连接",
  connecting: "连接中",
  connected: "已连接",
  error: "连接错误",
};

const DOT: Record<ConnectionStatus, string> = {
  disconnected: "bg-muted-foreground",
  connecting: "bg-warning",
  connected: "bg-success",
  error: "bg-destructive",
};

export function ConnectionControl({
  status,
  brokerUrl,
  onToggle,
}: {
  status: ConnectionStatus;
  brokerUrl: string;
  onToggle: () => void;
}) {
  const connected = status === "connected" || status === "connecting";
  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-1">
      <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
      <span className="text-xs text-foreground" data-testid="conn-status">
        MQTT {LABEL[status]}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">{brokerUrl}</span>
      <button
        type="button"
        onClick={onToggle}
        className="ml-1 rounded-sm border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-surface-inset"
      >
        {connected ? "断开" : "连接"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Topbar** — `src/hmi/components/Topbar.tsx`:
```tsx
"use client";

import { Activity } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { ConnectionControl } from "./ConnectionControl";
import type { ThemeMode } from "@/hmi/engine/theme";
import type { ConnectionStatus } from "@/hmi/data/data-source";

export function Topbar({
  title,
  status,
  brokerUrl,
  onToggleConnection,
  themeMode,
  onThemeChange,
}: {
  title: string;
  status: ConnectionStatus;
  brokerUrl: string;
  onToggleConnection: () => void;
  themeMode: ThemeMode;
  onThemeChange: (m: ThemeMode) => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      <Activity className="size-4 text-highlight-text" />
      <span className="truncate text-sm font-semibold text-foreground">{title}</span>
      <span className="flex-1" />
      <ConnectionControl status={status} brokerUrl={brokerUrl} onToggle={onToggleConnection} />
      <ThemeToggle mode={themeMode} onChange={onThemeChange} />
    </header>
  );
}
```

- [ ] **Step 4: 类型检查** — `npx tsc --noEmit 2>&1 | grep "src/hmi" || echo "hmi clean"`。
- [ ] **Step 5: Commit** — `git add src/hmi/components/ThemeToggle.tsx src/hmi/components/ConnectionControl.tsx src/hmi/components/Topbar.tsx && git commit -m "feat(hmi): topbar with connection control and theme toggle"`

---

## Task 7: Inspector + Topic 绑定编辑

**Files:** Create `src/hmi/components/TopicBindingEditor.tsx`, `Inspector.tsx`

- [ ] **Step 1: TopicBindingEditor** — `src/hmi/components/TopicBindingEditor.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { MimicNode } from "@/hmi/schema/schema";

export function TopicBindingEditor({
  node,
  onTopicsChange,
}: {
  node: MimicNode;
  onTopicsChange: (topics: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value || node.topics.includes(value)) return;
    onTopicsChange([...node.topics, value]);
    setDraft("");
  };
  const remove = (topic: string) => onTopicsChange(node.topics.filter((t) => t !== topic));

  // 哪些绑定 key 命中了某 topic
  const keysForTopic = (topic: string) =>
    Object.entries(node.bindings)
      .filter(([, b]) => b.topic === topic)
      .map(([key]) => key);

  return (
    <div>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        一个设备可绑多个 Topic，全部共用顶栏的同一条 MQTT 连接。
      </p>
      <ul className="space-y-2">
        {node.topics.map((topic) => (
          <li key={topic} className="rounded-sm border border-border p-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">{topic}</span>
              <button type="button" onClick={() => remove(topic)} aria-label={`移除 ${topic}`} className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {keysForTopic(topic).map((key) => (
                <span key={key} className="rounded-sm bg-surface-inset px-1.5 py-0.5 text-[10px] text-muted-foreground">{key}</span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="plant/1/.../telemetry"
          className="min-w-0 flex-1 rounded-sm border border-input bg-background px-2 py-1 font-mono text-[11px] text-foreground"
          data-testid="topic-input"
        />
        <button type="button" onClick={add} className="flex items-center rounded-sm border border-border px-2 text-foreground hover:bg-surface-inset" aria-label="添加 Topic">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Inspector** — `src/hmi/components/Inspector.tsx`:
```tsx
"use client";

import { X } from "lucide-react";
import { TopicBindingEditor } from "./TopicBindingEditor";
import type { MimicNode } from "@/hmi/schema/schema";
import type { NodeState } from "@/hmi/scene/scene";

export function Inspector({
  node,
  state,
  onClose,
  onTopicsChange,
}: {
  node: MimicNode;
  state: NodeState;
  onClose: () => void;
  onTopicsChange: (topics: string[]) => void;
}) {
  const entries = Object.entries(state.values);
  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card"
      aria-label="设备检视"
      data-testid="inspector"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground" data-testid="inspector-title">
          {node.label ?? node.id}
        </span>
        {state.fault ? (
          <span className="rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">报警</span>
        ) : state.stale ? (
          <span className="rounded-sm border border-border bg-surface-inset px-1.5 py-0.5 text-[10px] text-muted-foreground">失联</span>
        ) : null}
        <span className="flex-1" />
        <button type="button" onClick={onClose} aria-label="关闭" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">实时数据</p>
        {entries.length === 0 ? (
          <p className="mb-4 text-xs text-muted-foreground">暂无绑定数据</p>
        ) : (
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            {entries.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="text-right font-mono text-foreground">{value === undefined ? "--" : String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Topic 绑定</p>
        <TopicBindingEditor node={node} onTopicsChange={onTopicsChange} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: 类型检查** — `npx tsc --noEmit 2>&1 | grep "src/hmi" || echo "hmi clean"`。
- [ ] **Step 4: Commit** — `git add src/hmi/components/TopicBindingEditor.tsx src/hmi/components/Inspector.tsx && git commit -m "feat(hmi): docked inspector with topic binding editor"`

---

## Task 8: HmiPage 装配 + 默认 schema + 路由

**Files:** Create `src/hmi/components/HmiPage.tsx`, `public/schemas/default.json`, `src/routes/hmi.tsx`

- [ ] **Step 1: 默认 schema** — `public/schemas/default.json`（坐标已按图元 bounds 排布、管线 flush 接合）:
```json
{
  "meta": { "name": "1# 车间 · 反应釜进料", "version": 1 },
  "broker": { "url": "ws://broker.local:9001" },
  "nodes": [
    { "id": "TK-01", "type": "tank", "x": 120, "y": 200, "label": "TK-01 储罐",
      "topics": ["plant/1/TK-01"], "bindings": { "level": { "topic": "plant/1/TK-01", "path": "level" } }, "inline": ["level"] },
    { "id": "HV-01", "type": "valve", "x": 280, "y": 200, "label": "HV-01 调节阀",
      "topics": ["plant/1/HV-01"], "bindings": { "open": { "topic": "plant/1/HV-01", "path": "open" } }, "inline": ["open"] },
    { "id": "P-01", "type": "pump", "x": 400, "y": 200, "label": "P-01 离心泵",
      "topics": ["plant/1/P-01"], "bindings": { "running": { "topic": "plant/1/P-01", "path": "running" }, "rpm": { "topic": "plant/1/P-01", "path": "rpm" }, "fault": { "topic": "plant/1/P-01", "path": "fault" } }, "inline": ["rpm"] },
    { "id": "FT-01", "type": "meter", "x": 540, "y": 200, "label": "FT-01 流量",
      "topics": ["plant/1/FT-01"], "bindings": { "flow": { "topic": "plant/1/FT-01", "path": "flow" } }, "inline": ["flow"] }
  ],
  "edges": [
    { "id": "e1", "from": "TK-01", "to": "HV-01", "points": [[152, 200], [264, 200]], "flowBy": { "topic": "plant/1/FT-01", "path": "flow" } },
    { "id": "e2", "from": "HV-01", "to": "P-01", "points": [[296, 200], [378, 200]], "flowBy": { "topic": "plant/1/FT-01", "path": "flow" } },
    { "id": "e3", "from": "P-01", "to": "FT-01", "points": [[422, 200], [522, 200]], "flowBy": { "topic": "plant/1/FT-01", "path": "flow" } }
  ]
}
```

- [ ] **Step 2: HmiPage** — `src/hmi/components/HmiPage.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { HmiCanvas } from "./HmiCanvas";
import { Topbar } from "./Topbar";
import { Inspector } from "./Inspector";
import { createDefaultRegistry } from "@/hmi/symbols/default-registry";
import { buildScene, resolveNodeState } from "@/hmi/scene/scene";
import { resolveEdgeFlow } from "@/hmi/scene/edge-flow";
import { setNodeTopics } from "@/hmi/schema/edit";
import { createTagStore } from "@/hmi/data/tag-store";
import { createMockSource } from "@/hmi/data/mock-source";
import { mockSpecsFromSchema } from "@/hmi/data/mock-spec";
import { getPalette, type ThemeMode } from "@/hmi/engine/theme";
import type { Mimic, MimicEdge } from "@/hmi/schema/schema";
import type { ConnectionStatus } from "@/hmi/data/data-source";

export function HmiPage({ initialSchema }: { initialSchema: Mimic }) {
  const [schema, setSchema] = useState<Mimic>(initialSchema);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [connected, setConnected] = useState(true); // 用户意图：默认自动连接
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const registry = useMemo(() => createDefaultRegistry(), []);
  const scene = useMemo(() => buildScene(schema), [schema]);
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);

  const tagStoreRef = useRef(createTagStore());
  const tagStore = tagStoreRef.current;

  // Inspector 实时值：订阅 tagStore 快照
  const snapshot = useSyncExternalStore(tagStore.subscribe, tagStore.getSnapshot, tagStore.getSnapshot);
  const getPayload = (topic: string) => snapshot.get(topic);

  // 数据源：connected 意图为真时创建 mock 并驱动 status；为假时销毁。
  // 依赖 connected（用户意图）而非 status（源驱动），避免 onStatus→setStatus 反馈环，
  // 并确保断开时 effect 重跑、源被正确清理。
  useEffect(() => {
    if (!connected) {
      setStatus("disconnected");
      return;
    }
    const source = createMockSource(mockSpecsFromSchema(schema));
    const offMsg = source.onMessage((m) => tagStore.setMessage(m.topic, m.payload));
    const offStatus = source.onStatus(setStatus);
    source.connect();
    return () => {
      offMsg();
      offStatus();
      source.disconnect();
    };
  }, [connected, schema, tagStore]);

  const toggleConnection = () => setConnected((c) => !c);

  const getState = (nodeId: string) => {
    const node = scene.byId[nodeId];
    return resolveNodeState(node, (t) => tagStore.getSnapshot().get(t));
  };
  const isEdgeFlowing = (edge: MimicEdge) => resolveEdgeFlow(edge, (t) => tagStore.getSnapshot().get(t));
  const hasAnimation = () =>
    scene.nodes.some((n) => getState(n.id).fault) || scene.edges.some((e) => isEdgeFlowing(e));

  const selectedNode = selectedId ? scene.byId[selectedId] : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar
        title={schema.meta.name}
        status={status}
        brokerUrl={schema.broker?.url ?? "—"}
        onToggleConnection={toggleConnection}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1" style={{ backgroundColor: palette.canvas }}>
          <HmiCanvas
            scene={scene}
            registry={registry}
            palette={palette}
            getState={getState}
            isSelected={(id) => id === selectedId}
            isEdgeFlowing={isEdgeFlowing}
            hasAnimation={hasAnimation}
            subscribeData={tagStore.subscribe}
            onSelect={setSelectedId}
          />
        </div>
        {selectedNode ? (
          <Inspector
            node={selectedNode}
            state={resolveNodeState(selectedNode, getPayload)}
            onClose={() => setSelectedId(null)}
            onTopicsChange={(topics) => setSchema((s) => setNodeTopics(s, selectedNode.id, topics))}
          />
        ) : null}
      </div>
    </div>
  );
}
```

> 说明：Inspector 用 `useSyncExternalStore` 的 `snapshot` 渲染实时值（每条消息触发页面重渲，首切片几 Hz 可接受）；Canvas 不依赖 React 重渲，靠 `subscribeData→markDirty` 自驱。`hasAnimation` 每帧重算（节点少，可接受）。

- [ ] **Step 3: 路由** — `src/routes/hmi.tsx`（仿 `monitor.tsx` 的 auth，但全屏、自带顶栏）:
```tsx
import { createFileRoute, redirect, type ErrorComponentProps } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { HmiPage } from "@/hmi/components/HmiPage";
import { getCurrentUser } from "@/lib/auth";
import { apiUrl } from "@/lib/utils";
import { mimicSchema, type Mimic } from "@/hmi/schema/schema";
import type { AppUser } from "@/lib/users";
import { useEffect, useState } from "react";

const fetchHmiUser = createServerFn().handler(async (): Promise<AppUser | null> => getCurrentUser());

export const Route = createFileRoute("/hmi")({
  beforeLoad: async ({ location }) => {
    const user = await fetchHmiUser();
    if (!user) throw redirect({ to: "/login", search: { from: location.pathname } });
    return { user };
  },
  component: HmiRoute,
  errorComponent: HmiError,
});

function HmiRoute() {
  const [schema, setSchema] = useState<Mimic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/schemas/default.json"))
      .then((r) => r.json())
      .then((raw) => {
        const parsed = mimicSchema.safeParse(raw);
        if (cancelled) return;
        if (!parsed.success) setError(parsed.error.issues[0]?.message ?? "schema 校验失败");
        else setSchema(parsed.data);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "加载失败"));
    return () => { cancelled = true; };
  }, []);

  if (error) return <CenteredMessage text={`加载失败：${error}`} />;
  if (!schema) return <CenteredMessage text="加载中…" />;
  return <HmiPage initialSchema={schema} />;
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function HmiError({ error }: ErrorComponentProps) {
  return <CenteredMessage text={`页面错误：${error.message}`} />;
}
```

- [ ] **Step 4: 类型检查 + 构建** — `npx tsc --noEmit 2>&1 | grep "src/hmi\|src/routes/hmi" || echo "clean"`；`npm run build`（确认路由树生成 + 构建通过）。
- [ ] **Step 5: Commit** — `git add src/hmi/components/HmiPage.tsx public/schemas/default.json src/routes/hmi.tsx && git commit -m "feat(hmi): assemble HMI page, default schema, /hmi route"`

---

## Task 9: Playwright E2E

**Files:** Modify `package.json`; Create `playwright.config.ts`, `e2e/hmi.spec.ts`

- [ ] **Step 1: 安装 Playwright** — `npm install -D @playwright/test && npx playwright install chromium`

- [ ] **Step 2: 鉴权机制（已由控制端核实）** — `src/start.ts` 中间件：无 cookie + 网关 header 带 `role`（须在 `PERMISSION_MATRIX`，`admin` 已确认在内）→ 自动签发 session cookie + 302 回原 URL。`parseGatewayUser`（`src/lib/gateway.ts`）**只读请求 header，不读 env**（`PREVIEW_USER_*` 是平台网关层用的，app 不消费）。因此 E2E 用 Playwright `extraHTTPHeaders` 注入网关 header 即可自动登录，无需走 /login。`/login`、`/_serverFn`、`/_build`、`/api/health` 等是 PUBLIC_PATHS。

- [ ] **Step 3: playwright.config.ts**:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    // 网关 header 自动登录：middleware 见到有效 role 即签发 session cookie。
    extraHTTPHeaders: {
      "X-App-User-ID": "e2e-admin",
      "X-App-User-Name": "E2E Admin",
      "X-App-User-Role": "admin",
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SESSION_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
    },
  },
});
```

- [ ] **Step 4: 添加脚本** — `package.json` scripts 增加 `"e2e": "playwright test"`。

- [ ] **Step 5: e2e/hmi.spec.ts**:
```ts
import { test, expect } from "@playwright/test";

test.describe("HMI 页面", () => {
  test("加载、渲染画布、顶栏连接、主题切换、点选开 Inspector", async ({ page }) => {
    await page.goto("/hmi");

    // 画布存在
    const canvas = page.getByTestId("hmi-canvas");
    await expect(canvas).toBeVisible();

    // 顶栏 MQTT 状态最终显示已连接（自动连接 + mock）
    await expect(page.getByTestId("conn-status")).toContainText("已连接", { timeout: 10_000 });

    // 主题切换：点深色，按钮 aria-pressed 切换
    const group = page.getByRole("group", { name: "主题切换" });
    const buttons = group.getByRole("button");
    await buttons.nth(1).click(); // Moon
    await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");

    // 点中 P-01 泵（default.json 中 x=400,y=200 世界坐标；点画布对应位置）
    const box = await canvas.boundingBox();
    if (!box) throw new Error("no canvas box");
    // 画布会 fit 居中，难以精确换算世界→屏幕；改为点击画布中部附近扫描命中后断言 Inspector 出现
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

    // 若中点未命中，依次尝试几个点位，直到 Inspector 出现或断言失败
    const inspector = page.getByTestId("inspector");
    if (!(await inspector.isVisible())) {
      for (const fx of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        await canvas.click({ position: { x: box.width * fx, y: box.height / 2 } });
        if (await inspector.isVisible()) break;
      }
    }
    await expect(inspector).toBeVisible();
    await expect(page.getByTestId("inspector-title")).not.toBeEmpty();

    // 在 Inspector 加一个 topic
    await page.getByTestId("topic-input").fill("plant/1/extra/telemetry");
    await page.getByTestId("topic-input").press("Enter");
    await expect(page.getByText("plant/1/extra/telemetry")).toBeVisible();

    // 关闭 Inspector
    await page.getByRole("button", { name: "关闭" }).click();
    await expect(inspector).toBeHidden();
  });
});
```

> 说明：画布 fit 居中后世界→屏幕换算不稳定，E2E 用"扫描点位直到命中"的健壮策略断言点选交互，而非硬编码像素。若 5 个点位都没命中，说明渲染/命中有问题，测试失败。

- [ ] **Step 6: 运行 E2E** — `npm run e2e`
Expected: 1 passed。鉴权由 `extraHTTPHeaders` 网关 header 自动完成（首次导航触发 302 签发 cookie，Playwright 自动跟随）。若仍被重定向 /login，确认 `admin` 在 `PERMISSION_MATRIX`（`grep -n "admin" src/lib/permissions.ts`）；作为兜底再考虑显式 `/login` 选角色流程。

- [ ] **Step 7: 全量回归 + 构建** — `npm test`（纯逻辑全绿，计划C 新增 8 个：scene-bounds 2 + edit 3 + mock-spec 3）；`npm run build`（产物构建通过）。

- [ ] **Step 8: Commit** — `git add package.json package-lock.json playwright.config.ts e2e/ && git commit -m "test(hmi): playwright e2e for HMI page"`

---

## 完成标准（计划C Done = 整个垂直切片 Done）

1. `/hmi` 路由加载内置 schema → Canvas 渲出工艺图（罐→阀→泵→流量计 + 管线）。
2. 自动连接 mock → 罐液位变化、泵运行/故障、阀开闭、管线流向动画。
3. 顶栏：MQTT 连接状态 + 连/断按钮；主题切换浅/深。
4. 点图元 → 右侧停靠 Inspector（不压暗画布）显实时值 + 多 topic 绑定编辑，加 topic 回写生效。
5. 纯逻辑单测全绿（计划A+B+C 累计），E2E 主流程通过，`npm run build` 通过。

## Self-Review 记录

- **Spec 覆盖**：viewer+极简编辑→Inspector 加/删 topic（§2）；单连接顶栏控制→Topbar/ConnectionControl；点选停靠非模态→Inspector（挤压不覆盖）；双主题→ThemeToggle+getPalette；schema 上传/校验→路由 fetch+mimicSchema.safeParse（首切片为加载内置 + 客户端校验，运行时文件上传 UI 留待后续）；fit→sceneBounds+viewport.fit。
- **占位符**：无 TBD。E2E 点选用扫描点位策略（已说明原因）；鉴权两条路径（PREVIEW_USER_* 优先、login 兜底）在 Task 9 Step 2/6 明确。
- **类型一致**：`Mimic/MimicNode/MimicEdge`、`NodeState`、`ConnectionStatus`、`ThemeMode`、`Palette`、`Registry`、`Scene` 跨组件复用，签名与计划A/B 一致；`HmiCanvas` props 与 `HmiPage` 传参逐项对齐；`subscribeData=tagStore.subscribe`、`getState`/`isEdgeFlowing` 用 `tagStore.getSnapshot().get` 实时读。
- **已知简化（非缺陷，记录给后续子项目）**：theme 仍用 getPalette 硬编码值（未桥接 globals.css token）；运行时 schema 文件上传 UI 未做（仅加载内置 + 校验）；hit-test 矩形 bbox；慢闪周期 1000ms。
