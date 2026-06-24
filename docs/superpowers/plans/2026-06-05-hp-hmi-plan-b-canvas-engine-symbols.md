# HP-HMI 计划B — Canvas 引擎 + 图元 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在计划A 数据地基之上，构建 Canvas 2D 渲染引擎与首批 HP-HMI 图元，把 schema + 实时状态画成可交互的工艺图。

**Architecture:** 图元层产出**中间图元 IR**（`Primitive[]`，纯函数、可单测、天然 render-backend-agnostic）；一个通用 `painter` 把 IR 绘到 canvas ctx；状态语言（`state-language`）把 `NodeState` 映射为统一装饰（填充深浅 / 红环慢闪 / 角标 / 失联虚线褪色）；`viewport` 管世界↔屏幕变换，`hit-test` 反查命中节点，`render-loop` 用 rAF + 脏标记 + 动画相位驱动重绘，`canvas-stage` 负责 DOM/DPR/resize。

**Tech Stack:** TypeScript (strict, ESM), Canvas 2D, `node:test` + `tsx`。引擎纯逻辑用伪 ctx 测试；DOM 部分（stage）留待计划C E2E 验证。

参考：spec `docs/superpowers/specs/2026-06-05-hp-hmi-mimic-template-design.md`（§3 状态语言、§5 数据流、§11 取舍）；计划A 终审遗留项（edge.flowBy 解析归 model 层、未知 type 兜底、mock counter）。

依赖计划A 导出：`MimicNode/MimicEdge/Mimic`（schema）、`NodeState`（scene）、`Scene`（scene）、`resolveBinding`（data/binding）。

---

## 文件结构（本计划产出）

```
src/hmi/engine/
  primitives.ts        # Primitive IR 类型 + Style
  painter.ts           # paint(ctx, primitives, phase) 通用绘制
  painter.test.ts
  theme.ts             # Palette + light/dark 调色板 + getPalette
  theme.test.ts
  viewport.ts          # 世界↔屏幕变换, fit, zoomAt
  viewport.test.ts
  hit-test.ts          # 屏幕坐标 → 命中 nodeId
  hit-test.test.ts
  render-loop.ts       # rAF + 脏标记 + 动画相位（注入 raf/now 可测）
  render-loop.test.ts
  canvas-stage.ts      # DOM canvas + DPR + ResizeObserver（薄，C 计划 E2E 验证）
src/hmi/symbols/
  state-language.ts    # NodeState → Decoration（装饰编码，唯一来源）
  state-language.test.ts
  registry.ts          # SymbolDef 类型 + 注册表 + 未知 type 兜底
  registry.test.ts
  decoration.ts        # Decoration → Primitive[]（红环/角标/共用装饰绘制）
  decoration.test.ts
  tank.ts pump.ts valve.ts meter.ts   # 各图元 buildPrimitives（纯）
  tank.test.ts pump.test.ts valve.test.ts meter.test.ts
  scene-render.ts      # 组合 scene+状态+主题 → Primitive[]（节点+管线+装饰）
  scene-render.test.ts
src/hmi/scene/
  edge-flow.ts         # resolveEdgeFlow(edge,getPayload)（model 层, 兑现终审建议）
  edge-flow.test.ts
```

约定：`src/hmi` 内部相对导入。图元/引擎纯函数零 DOM 依赖；只有 `canvas-stage.ts` 碰 DOM。所有数据不可变。

---

## Task 1: Primitive IR + 通用 painter

**Files:** Create `src/hmi/engine/primitives.ts`, `src/hmi/engine/painter.ts`; Test `src/hmi/engine/painter.test.ts`

- [ ] **Step 1: 写 primitives.ts（纯类型）**

`src/hmi/engine/primitives.ts`:
```ts
export interface Style {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly dash?: readonly number[];
  readonly opacity?: number;
  readonly font?: string;
  readonly textAlign?: "left" | "center" | "right";
  readonly lineCap?: "butt" | "round";
  /** 报警慢闪：painter 按相位调制透明度。 */
  readonly blink?: boolean;
}

export type Primitive =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly r?: number; readonly style: Style }
  | { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number; readonly style: Style }
  | { readonly kind: "line"; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly style: Style; readonly flow?: boolean }
  | { readonly kind: "polyline"; readonly points: readonly (readonly [number, number])[]; readonly style: Style; readonly flow?: boolean }
  | { readonly kind: "polygon"; readonly points: readonly (readonly [number, number])[]; readonly style: Style }
  | { readonly kind: "text"; readonly x: number; readonly y: number; readonly text: string; readonly style: Style };
```

- [ ] **Step 2: 写失败测试**

`src/hmi/engine/painter.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paint } from "./painter";
import type { Primitive } from "./primitives";

/** 伪 ctx：记录所有调用与属性赋值。 */
function fakeCtx() {
  const calls: string[] = [];
  const set: Record<string, unknown> = {};
  const handler = {
    get(_t: unknown, prop: string) {
      if (["fillStyle", "strokeStyle", "lineWidth", "globalAlpha", "font", "textAlign", "lineCap", "lineDashOffset"].includes(prop)) {
        return set[prop];
      }
      return (...args: unknown[]) => { calls.push(`${prop}(${args.join(",")})`); };
    },
    set(_t: unknown, prop: string, value: unknown) { set[prop] = value; calls.push(`${prop}=${value}`); return true; },
  };
  const ctx = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, set };
}

describe("paint", () => {
  it("画 circle：设置 fill/stroke 并调用 arc+fill+stroke", () => {
    const prims: Primitive[] = [
      { kind: "circle", cx: 10, cy: 20, r: 5, style: { fill: "#fff", stroke: "#000", strokeWidth: 2 } },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0);
    assert.ok(calls.includes("fillStyle=#fff"));
    assert.ok(calls.includes("strokeStyle=#000"));
    assert.ok(calls.includes("lineWidth=2"));
    assert.ok(calls.some((c) => c.startsWith("arc(10,20,5")));
    assert.ok(calls.includes("fill()"));
    assert.ok(calls.includes("stroke()"));
  });

  it("画 text：设置 font/textAlign 并 fillText", () => {
    const prims: Primitive[] = [
      { kind: "text", x: 1, y: 2, text: "62%", style: { fill: "#000", font: "16px sans", textAlign: "center" } },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0);
    assert.ok(calls.includes("font=16px sans"));
    assert.ok(calls.includes("textAlign=center"));
    assert.ok(calls.some((c) => c.startsWith("fillText(62%,1,2")));
  });

  it("blink 在相位 0.5 时降低 globalAlpha", () => {
    const prims: Primitive[] = [
      { kind: "circle", cx: 0, cy: 0, r: 1, style: { fill: "#f00", blink: true } },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0.5);
    assert.ok(calls.some((c) => c.startsWith("globalAlpha=") && !c.endsWith("=1")));
  });

  it("flow line 设置 lineDashOffset 随相位变化", () => {
    const prims: Primitive[] = [
      { kind: "line", x1: 0, y1: 0, x2: 10, y2: 0, style: { stroke: "#000", strokeWidth: 3 }, flow: true },
    ];
    const { ctx, calls } = fakeCtx();
    paint(ctx, prims, 0.5);
    assert.ok(calls.some((c) => c.startsWith("lineDashOffset=")));
  });
});
```

- [ ] **Step 3: 运行确认失败** — `node --import tsx --test src/hmi/engine/painter.test.ts` → FAIL（模块不存在）。

- [ ] **Step 4: 实现 painter.ts**

`src/hmi/engine/painter.ts`:
```ts
import type { Primitive, Style } from "./primitives";

const FLOW_DASH: number[] = [9, 9];
const FLOW_SPEED = 18; // 每个相位周期移动的像素

function applyStroke(ctx: CanvasRenderingContext2D, style: Style): boolean {
  if (!style.stroke) return false;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.strokeWidth ?? 1;
  ctx.lineCap = style.lineCap ?? "butt";
  ctx.setLineDash(style.dash ? [...style.dash] : []);
  return true;
}

function applyFill(ctx: CanvasRenderingContext2D, style: Style): boolean {
  if (!style.fill) return false;
  ctx.fillStyle = style.fill;
  return true;
}

/** blink: 相位 0→1，透明度在 1↔0.3 间正弦摆动。 */
function alpha(style: Style, phase: number): number {
  const base = style.opacity ?? 1;
  if (!style.blink) return base;
  const wave = 0.65 + 0.35 * Math.cos(phase * Math.PI * 2);
  return base * wave;
}

function tracePoints(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], close: boolean): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
}

export function paint(ctx: CanvasRenderingContext2D, primitives: readonly Primitive[], phase: number): void {
  for (const p of primitives) {
    ctx.globalAlpha = alpha(p.style, phase);
    switch (p.kind) {
      case "rect": {
        ctx.beginPath();
        if (p.r) ctx.roundRect(p.x, p.y, p.w, p.h, p.r);
        else ctx.rect(p.x, p.y, p.w, p.h);
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "circle": {
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "polygon": {
        tracePoints(ctx, p.points, true);
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "polyline":
      case "line": {
        if (p.kind === "line") tracePoints(ctx, [[p.x1, p.y1], [p.x2, p.y2]], false);
        else tracePoints(ctx, p.points, false);
        applyStroke(ctx, p.style);
        ctx.stroke();
        if (p.flow) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.setLineDash(FLOW_DASH);
          ctx.lineDashOffset = -phase * FLOW_SPEED;
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "text": {
        if (p.style.font) ctx.font = p.style.font;
        ctx.textAlign = p.style.textAlign ?? "left";
        applyFill(ctx, p.style);
        ctx.fillText(p.text, p.x, p.y);
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 5: 运行确认通过** — `node --import tsx --test src/hmi/engine/painter.test.ts` → PASS（4 tests）。

- [ ] **Step 6: Commit** — `git add src/hmi/engine/primitives.ts src/hmi/engine/painter.ts src/hmi/engine/painter.test.ts && git commit -m "feat(hmi): primitive IR and generic canvas painter"`

---

## Task 2: 主题调色板

**Files:** Create `src/hmi/engine/theme.ts`; Test `src/hmi/engine/theme.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/engine/theme.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPalette, PALETTES } from "./theme";

describe("getPalette", () => {
  it("light/dark 各含全部角色键", () => {
    const keys = ["canvas", "stroke", "fillLight", "fillDeep", "liquid", "text", "textMuted", "alarm", "running", "interlock", "selection", "stale"];
    for (const mode of ["light", "dark"] as const) {
      for (const k of keys) {
        assert.equal(typeof PALETTES[mode][k as keyof (typeof PALETTES)["light"]], "string");
      }
    }
  });
  it("light 与 dark 的 canvas 底色不同", () => {
    assert.notEqual(getPalette("light").canvas, getPalette("dark").canvas);
  });
});
```

- [ ] **Step 2: 运行确认失败** — `node --import tsx --test src/hmi/engine/theme.test.ts` → FAIL。

- [ ] **Step 3: 实现 theme.ts**（值镜像 spec §3，canvas 需 JS 色值；计划C 可用 globals.css 覆盖）

`src/hmi/engine/theme.ts`:
```ts
export interface Palette {
  readonly canvas: string;
  readonly stroke: string;
  readonly fillLight: string;
  readonly fillDeep: string;
  readonly liquid: string;
  readonly text: string;
  readonly textMuted: string;
  readonly alarm: string;
  readonly running: string;
  readonly interlock: string;
  readonly selection: string;
  readonly stale: string;
}

export type ThemeMode = "light" | "dark";

export const PALETTES: Record<ThemeMode, Palette> = {
  light: {
    canvas: "#d4d7da", stroke: "#545960", fillLight: "#eef0f2", fillDeep: "#6b7178",
    liquid: "#8fa0ad", text: "#2b2e33", textMuted: "#6c7178",
    alarm: "#b0473d", running: "#4a9d6f", interlock: "#b58a2e", selection: "#2f8f83", stale: "#aeb3b8",
  },
  dark: {
    canvas: "#20242a", stroke: "#8b929b", fillLight: "#2f353d", fillDeep: "#9aa1aa",
    liquid: "#43525f", text: "#d4d8dc", textMuted: "#868d95",
    alarm: "#db6a5d", running: "#5cb585", interlock: "#c59a3a", selection: "#3aa597", stale: "#5a626b",
  },
};

export function getPalette(mode: ThemeMode): Palette {
  return PALETTES[mode];
}
```

- [ ] **Step 4: 运行确认通过** — PASS（2 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/engine/theme.ts src/hmi/engine/theme.test.ts && git commit -m "feat(hmi): light/dark HP-HMI palettes"`

---

## Task 3: 状态语言（装饰编码）

**Files:** Create `src/hmi/symbols/state-language.ts`; Test `src/hmi/symbols/state-language.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/symbols/state-language.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDecoration } from "./state-language";
import type { NodeState } from "../scene/scene";

const base: NodeState = { values: {}, running: false, fault: false, stale: false };

describe("resolveDecoration", () => {
  it("正常未选中：无环无角标不闪", () => {
    const d = resolveDecoration(base, false);
    assert.deepEqual(d, { ring: "none", badge: "none", blink: false, faded: false, dashed: false });
  });
  it("选中：青绿环", () => {
    assert.equal(resolveDecoration(base, true).ring, "selection");
  });
  it("故障：红环 + 故障角标 + 慢闪，优先于选中", () => {
    const d = resolveDecoration({ ...base, fault: true }, true);
    assert.equal(d.ring, "fault");
    assert.equal(d.badge, "fault");
    assert.equal(d.blink, true);
  });
  it("失联：虚线 + 褪色 + 失联角标", () => {
    const d = resolveDecoration({ ...base, stale: true }, false);
    assert.equal(d.dashed, true);
    assert.equal(d.faded, true);
    assert.equal(d.badge, "stale");
  });
  it("手动模式角标（无故障无联锁时）", () => {
    const d = resolveDecoration({ ...base, values: { manual: true } }, false);
    assert.equal(d.badge, "manual");
  });
  it("联锁优先于手动", () => {
    const d = resolveDecoration({ ...base, values: { manual: true, interlock: true } }, false);
    assert.equal(d.badge, "interlock");
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 state-language.ts**

`src/hmi/symbols/state-language.ts`:
```ts
import type { NodeState } from "../scene/scene";

export type Ring = "none" | "selection" | "fault";
export type Badge = "none" | "manual" | "interlock" | "fault" | "stale";

export interface Decoration {
  readonly ring: Ring;
  readonly badge: Badge;
  readonly blink: boolean;
  readonly faded: boolean;
  readonly dashed: boolean;
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["1", "true", "on", "yes"].includes(value.toLowerCase());
  }
  return false;
}

/**
 * 把节点状态映射为统一装饰编码（spec §3）。
 * 优先级：失联 > 故障 > 选中；角标 故障 > 联锁 > 手动。
 */
export function resolveDecoration(state: NodeState, selected: boolean): Decoration {
  if (state.stale) {
    return { ring: selected ? "selection" : "none", badge: "stale", blink: false, faded: true, dashed: true };
  }
  const interlock = toBool(state.values.interlock);
  const manual = toBool(state.values.manual);
  const ring: Ring = state.fault ? "fault" : selected ? "selection" : "none";
  const badge: Badge = state.fault ? "fault" : interlock ? "interlock" : manual ? "manual" : "none";
  return { ring, badge, blink: state.fault, faded: false, dashed: false };
}
```

- [ ] **Step 4: 运行确认通过**（6 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/state-language.ts src/hmi/symbols/state-language.test.ts && git commit -m "feat(hmi): state language decoration mapping"`

---

## Task 4: 视口变换

**Files:** Create `src/hmi/engine/viewport.ts`; Test `src/hmi/engine/viewport.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/engine/viewport.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createViewport, toWorld, toScreen, zoomAt } from "./viewport";

describe("viewport", () => {
  it("默认 1:1，屏幕=世界", () => {
    const vp = createViewport();
    assert.deepEqual(toScreen(vp, 10, 20), { x: 10, y: 20 });
  });
  it("平移后 toScreen 加偏移", () => {
    const vp = { scale: 1, x: 5, y: 7 };
    assert.deepEqual(toScreen(vp, 10, 20), { x: 15, y: 27 });
  });
  it("toWorld 是 toScreen 的逆", () => {
    const vp = { scale: 2, x: 5, y: 7 };
    const s = toScreen(vp, 10, 20);
    assert.deepEqual(toWorld(vp, s.x, s.y), { x: 10, y: 20 });
  });
  it("zoomAt 保持锚点屏幕位置不变", () => {
    const vp = { scale: 1, x: 0, y: 0 };
    const z = zoomAt(vp, 100, 100, 2);
    assert.equal(z.scale, 2);
    // 锚点 (100,100) 屏幕坐标在缩放前后一致
    const before = toScreen(vp, ...Object.values(toWorld(vp, 100, 100)) as [number, number]);
    const after = toScreen(z, ...Object.values(toWorld(vp, 100, 100)) as [number, number]);
    assert.deepEqual(before, after);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 viewport.ts**

`src/hmi/engine/viewport.ts`:
```ts
export interface Viewport {
  readonly scale: number;
  readonly x: number; // 屏幕平移 x
  readonly y: number;
}

export function createViewport(): Viewport {
  return { scale: 1, x: 0, y: 0 };
}

export function toScreen(vp: Viewport, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * vp.scale + vp.x, y: wy * vp.scale + vp.y };
}

export function toWorld(vp: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
}

/** 以屏幕点 (sx,sy) 为锚点缩放到 scale，锚点屏幕位置不变。 */
export function zoomAt(vp: Viewport, sx: number, sy: number, scale: number): Viewport {
  const world = toWorld(vp, sx, sy);
  return { scale, x: sx - world.x * scale, y: sy - world.y * scale };
}

/** 适配：把世界包围盒缩放平移到画布内并居中。 */
export function fit(
  box: { x: number; y: number; w: number; h: number },
  view: { w: number; h: number },
  padding = 24,
): Viewport {
  if (box.w <= 0 || box.h <= 0) return createViewport();
  const scale = Math.min((view.w - padding * 2) / box.w, (view.h - padding * 2) / box.h);
  const x = (view.w - box.w * scale) / 2 - box.x * scale;
  const y = (view.h - box.h * scale) / 2 - box.y * scale;
  return { scale, x, y };
}
```

- [ ] **Step 4: 运行确认通过**（4 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/engine/viewport.ts src/hmi/engine/viewport.test.ts && git commit -m "feat(hmi): viewport transform (pan/zoom/fit)"`

---

## Task 5: 符号注册表 + SymbolDef 契约 + 未知 type 兜底

**Files:** Create `src/hmi/symbols/registry.ts`; Test `src/hmi/symbols/registry.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/symbols/registry.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRegistry, type SymbolDef } from "./registry";
import type { Primitive } from "../engine/primitives";
import { getPalette } from "../engine/theme";

const PALETTE_STUB = getPalette("light");

const dummy: SymbolDef = {
  type: "dummy",
  build: () => [{ kind: "circle", cx: 0, cy: 0, r: 1, style: { fill: "#000" } } as Primitive],
  bounds: (node) => ({ x: node.x - 10, y: node.y - 10, w: 20, h: 20 }),
};

describe("registry", () => {
  it("注册后可取回", () => {
    const reg = createRegistry([dummy]);
    assert.equal(reg.get("dummy"), dummy);
  });
  it("未知 type 返回 fallback 而非 undefined", () => {
    const reg = createRegistry([dummy]);
    const def = reg.get("nonexistent");
    assert.ok(def);
    assert.equal(def.type, "unknown");
  });
  it("fallback 的 build 产出占位图元（不抛）", () => {
    const reg = createRegistry([dummy]);
    const node = { id: "x", type: "nonexistent", x: 5, y: 5, rotation: 0, topics: [], bindings: {}, inline: [] };
    const prims = reg.get(node.type).build({ node, state: { values: {}, running: false, fault: false, stale: false }, theme: PALETTE_STUB });
    assert.ok(Array.isArray(prims) && prims.length > 0);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 registry.ts**

`src/hmi/symbols/registry.ts`:
```ts
import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";

export interface SymbolContext {
  readonly node: MimicNode;
  readonly state: NodeState;
  readonly theme: Palette;
}

export interface SymbolDef {
  readonly type: string;
  /** 纯函数：产出该图元在当前状态下的图元 IR（世界坐标，锚点 = node.x/y）。 */
  build(ctx: SymbolContext): Primitive[];
  /** 命中包围盒（世界坐标）。 */
  bounds(node: MimicNode): { x: number; y: number; w: number; h: number };
  /** 默认内联字段（schema node.inline 可覆盖）。 */
  readonly inlineFields?: readonly string[];
}

export interface Registry {
  get(type: string): SymbolDef;
}

/** 未知 type 兜底：画一个虚线方框 + "?"，绝不让整图崩。 */
const fallback: SymbolDef = {
  type: "unknown",
  build: ({ node, theme }) => [
    { kind: "rect", x: node.x - 16, y: node.y - 16, w: 32, h: 32, r: 3, style: { stroke: theme.stale, strokeWidth: 1.5, dash: [3, 3] } },
    { kind: "text", x: node.x, y: node.y + 5, text: "?", style: { fill: theme.stale, font: "16px ui-sans-serif, system-ui", textAlign: "center" } },
  ],
  bounds: (node) => ({ x: node.x - 16, y: node.y - 16, w: 32, h: 32 }),
};

export function createRegistry(defs: readonly SymbolDef[]): Registry {
  const byType = new Map<string, SymbolDef>();
  for (const def of defs) byType.set(def.type, def);
  return {
    get(type) {
      return byType.get(type) ?? fallback;
    },
  };
}
```

> 说明：测试里 `reg.get(...)!` 的非空断言安全——`get` 永远返回 `SymbolDef`（兜底）。注意测试导入顺序，`PALETTE_STUB` 在文件末尾定义会被提升前引用——把 `import { getPalette }` 和 `const PALETTE_STUB` 移到文件顶部以避免 TDZ。实现者应将这两行放到测试文件顶部 import 区。

- [ ] **Step 4: 运行确认通过**（3 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/registry.ts src/hmi/symbols/registry.test.ts && git commit -m "feat(hmi): symbol registry with unknown-type fallback"`

---

## Task 6: 装饰渲染（Decoration → Primitive[]）

**Files:** Create `src/hmi/symbols/decoration.ts`; Test `src/hmi/symbols/decoration.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/symbols/decoration.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDecoration } from "./decoration";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const center = { cx: 100, cy: 100, r: 22 };

describe("buildDecoration", () => {
  it("ring=none 不产出环", () => {
    const prims = buildDecoration({ ring: "none", badge: "none", blink: false, faded: false, dashed: false }, center, theme);
    assert.equal(prims.length, 0);
  });
  it("ring=fault 产出红环（circle 描边 alarm 色）", () => {
    const prims = buildDecoration({ ring: "fault", badge: "none", blink: true, faded: false, dashed: false }, center, theme);
    const ring = prims.find((p) => p.kind === "circle");
    assert.ok(ring);
    assert.equal((ring as { style: { stroke?: string } }).style.stroke, theme.alarm);
  });
  it("badge=manual 产出 M 角标文本", () => {
    const prims = buildDecoration({ ring: "none", badge: "manual", blink: false, faded: false, dashed: false }, center, theme);
    assert.ok(prims.some((p) => p.kind === "text" && p.text === "M"));
  });
  it("badge=fault 产出 ! 角标且 blink", () => {
    const prims = buildDecoration({ ring: "fault", badge: "fault", blink: true, faded: false, dashed: false }, center, theme);
    const bang = prims.find((p) => p.kind === "text" && p.text === "!");
    assert.ok(bang);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 decoration.ts**

`src/hmi/symbols/decoration.ts`:
```ts
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";
import type { Decoration, Badge } from "./state-language";

export interface AnchorCircle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

const BADGE_TEXT: Record<Exclude<Badge, "none">, string> = {
  manual: "M",
  interlock: "L",
  fault: "!",
  stale: "?",
};

function badgeColor(badge: Badge, theme: Palette): string {
  switch (badge) {
    case "fault": return theme.alarm;
    case "interlock": return theme.interlock;
    case "manual": return theme.text;
    case "stale": return theme.stale;
    default: return theme.stale;
  }
}

/** 把装饰编码画成图元：选中/故障环 + 右上角标。anchor 为图元主体外接圆。 */
export function buildDecoration(deco: Decoration, anchor: AnchorCircle, theme: Palette): Primitive[] {
  const out: Primitive[] = [];
  if (deco.ring === "selection") {
    out.push({ kind: "circle", cx: anchor.cx, cy: anchor.cy, r: anchor.r + 9, style: { stroke: theme.selection, strokeWidth: 2 } });
  } else if (deco.ring === "fault") {
    out.push({ kind: "circle", cx: anchor.cx, cy: anchor.cy, r: anchor.r + 5, style: { stroke: theme.alarm, strokeWidth: 3, blink: deco.blink } });
  }
  if (deco.badge !== "none") {
    const bx = anchor.cx + anchor.r * 0.8;
    const by = anchor.cy - anchor.r * 0.8;
    const color = badgeColor(deco.badge, theme);
    out.push({ kind: "circle", cx: bx, cy: by, r: 8, style: { fill: color, blink: deco.badge === "fault" && deco.blink } });
    out.push({ kind: "text", x: bx, y: by + 4, text: BADGE_TEXT[deco.badge], style: { fill: "#ffffff", font: "700 11px ui-sans-serif, system-ui", textAlign: "center", blink: deco.badge === "fault" && deco.blink } });
  }
  return out;
}
```

- [ ] **Step 4: 运行确认通过**（4 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/decoration.ts src/hmi/symbols/decoration.test.ts && git commit -m "feat(hmi): decoration primitives (ring + badge)"`

---

## Task 7: 罐体图元（带活液位）

**Files:** Create `src/hmi/symbols/tank.ts`; Test `src/hmi/symbols/tank.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/symbols/tank.ts` 约定：罐体宽 64 高 104，锚点为中心 (node.x,node.y)；`values.level`（0~100）决定液位高度；内联显示 `level%`。

`src/hmi/symbols/tank.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tank } from "./tank";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "TK-01", type: "tank", x: 100, y: 100, rotation: 0, label: "TK-01", topics: ["t"], bindings: {}, inline: [], };

function build(level: unknown) {
  return tank.build({ node, state: { values: { level }, running: false, fault: false, stale: false }, theme });
}

describe("tank symbol", () => {
  it("液位 0：无液体矩形或高度为 0", () => {
    const prims = build(0);
    const liquid = prims.find((p) => p.kind === "rect" && (p as { style: { fill?: string } }).style.fill === theme.liquid) as { h: number } | undefined;
    assert.ok(!liquid || liquid.h === 0);
  });
  it("液位 50：液体高度约为罐高一半", () => {
    const prims = build(50);
    const liquid = prims.find((p) => p.kind === "rect" && (p as { style: { fill?: string } }).style.fill === theme.liquid) as { h: number };
    assert.ok(liquid.h > 45 && liquid.h < 60); // 104*0.5≈52
  });
  it("内联显示百分比文本", () => {
    const prims = build(62);
    assert.ok(prims.some((p) => p.kind === "text" && /62/.test((p as { text: string }).text)));
  });
  it("bounds 居中于节点", () => {
    const b = tank.bounds(node);
    assert.equal(b.x, 100 - 32);
    assert.equal(b.w, 64);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 tank.ts**

`src/hmi/symbols/tank.ts`:
```ts
import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";

const W = 64;
const H = 104;

function levelPct(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export const tank: SymbolDef = {
  type: "tank",
  inlineFields: ["level"],
  bounds: (node) => ({ x: node.x - W / 2, y: node.y - H / 2, w: W, h: H }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const left = node.x - W / 2;
    const top = node.y - H / 2;
    const pct = levelPct(state.values.level);
    const liquidH = (H * pct) / 100;
    const out: Primitive[] = [
      { kind: "rect", x: left, y: top, w: W, h: H, r: 6, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    if (liquidH > 0) {
      out.push({ kind: "rect", x: left, y: top + (H - liquidH), w: W, h: liquidH, style: { fill: theme.liquid } });
    }
    out.push({ kind: "text", x: node.x, y: node.y + 5, text: `${Math.round(pct)}%`, style: { fill: theme.text, font: "600 18px ui-sans-serif, system-ui", textAlign: "center" } });
    if (node.label) {
      out.push({ kind: "text", x: node.x, y: top - 8, text: node.label, style: { fill: theme.textMuted, font: "11px ui-sans-serif, system-ui", textAlign: "center" } });
    }
    return out;
  },
};
```

> 实现简化（非缺陷）：液体用矩形覆盖在罐体内，不做圆角裁剪——本切片视觉足够，圆角 clip 留待迭代。罐体圆角半径 6 远小于罐宽，液体矩形溢出仅在四角极小区域，可接受。

- [ ] **Step 4: 运行确认通过**（4 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/tank.ts src/hmi/symbols/tank.test.ts && git commit -m "feat(hmi): tank symbol with live liquid level"`

---

## Task 8: 泵图元

**Files:** Create `src/hmi/symbols/pump.ts`; Test `src/hmi/symbols/pump.test.ts`

- [ ] **Step 1: 写失败测试**

约定：泵 = 圆（r=22）+ 叶轮三角；`state.running` 决定深/浅填充。

`src/hmi/symbols/pump.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pump } from "./pump";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "P-01", type: "pump", x: 100, y: 100, rotation: 0, label: "P-01", topics: ["t"], bindings: {}, inline: [] };

function body(running: boolean) {
  const prims = pump.build({ node, state: { values: {}, running, fault: false, stale: false }, theme });
  return prims.find((p) => p.kind === "circle") as { style: { fill?: string } };
}

describe("pump symbol", () => {
  it("运行：深填充", () => {
    assert.equal(body(true).style.fill, theme.fillDeep);
  });
  it("停止：浅填充", () => {
    assert.equal(body(false).style.fill, theme.fillLight);
  });
  it("含叶轮三角（polygon）", () => {
    const prims = pump.build({ node, state: { values: {}, running: true, fault: false, stale: false }, theme });
    assert.ok(prims.some((p) => p.kind === "polygon"));
  });
  it("bounds 半径含余量", () => {
    const b = pump.bounds(node);
    assert.equal(b.w, b.h);
    assert.ok(b.w >= 44);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 pump.ts**

`src/hmi/symbols/pump.ts`:
```ts
import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";

const R = 22;

export const pump: SymbolDef = {
  type: "pump",
  inlineFields: ["rpm"],
  bounds: (node) => ({ x: node.x - R - 2, y: node.y - R - 2, w: (R + 2) * 2, h: (R + 2) * 2 }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const fill = state.running ? theme.fillDeep : theme.fillLight;
    const impeller = state.running ? theme.fillLight : theme.stroke;
    const cx = node.x;
    const cy = node.y;
    const out: Primitive[] = [
      { kind: "circle", cx, cy, r: R, style: { fill, stroke: theme.stroke, strokeWidth: 2 } },
      { kind: "polygon", points: [[cx - 8, cy - 12], [cx - 8, cy + 12], [cx + 14, cy]], style: state.running ? { fill: impeller } : { stroke: impeller, strokeWidth: 2 } },
    ];
    if (node.label) {
      out.push({ kind: "text", x: cx, y: cy + R + 16, text: node.label, style: { fill: theme.textMuted, font: "10px ui-sans-serif, system-ui", textAlign: "center" } });
    }
    return out;
  },
};
```

- [ ] **Step 4: 运行确认通过**（4 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/pump.ts src/hmi/symbols/pump.test.ts && git commit -m "feat(hmi): pump symbol with run/stop fill"`

---

## Task 9: 阀图元

**Files:** Create `src/hmi/symbols/valve.ts`; Test `src/hmi/symbols/valve.test.ts`

- [ ] **Step 1: 写失败测试**

约定：阀 = 蝶形双三角；`values.open`（或 running）决定开/关 → 浅(空心通路)/深(实心阻断)填充。

`src/hmi/symbols/valve.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { valve } from "./valve";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "HV-01", type: "valve", x: 100, y: 100, rotation: 0, label: "HV-01", topics: ["t"], bindings: {}, inline: [] };

function polys(open: unknown) {
  const prims = valve.build({ node, state: { values: { open }, running: false, fault: false, stale: false }, theme });
  return prims.filter((p) => p.kind === "polygon") as { style: { fill?: string } }[];
}

describe("valve symbol", () => {
  it("开启：浅填充（空心通路）", () => {
    assert.equal(polys(true)[0].style.fill, theme.fillLight);
  });
  it("关闭：深填充（实心阻断）", () => {
    assert.equal(polys(false)[0].style.fill, theme.fillDeep);
  });
  it("产出两个三角（蝶形）", () => {
    assert.equal(polys(true).length, 2);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 valve.ts**

`src/hmi/symbols/valve.ts`:
```ts
import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";

const HW = 16; // 半宽
const HH = 13; // 半高

function isOpen(values: Readonly<Record<string, unknown>>): boolean {
  const v = values.open ?? values.running;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["1", "true", "open", "on", "run"].includes(v.toLowerCase());
  return false;
}

export const valve: SymbolDef = {
  type: "valve",
  inlineFields: ["open"],
  bounds: (node) => ({ x: node.x - HW - 2, y: node.y - HH - 2, w: (HW + 2) * 2, h: (HH + 2) * 2 }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const fill = isOpen(state.values) ? theme.fillLight : theme.fillDeep;
    const cx = node.x;
    const cy = node.y;
    const style = { fill, stroke: theme.stroke, strokeWidth: 2 };
    const out: Primitive[] = [
      { kind: "polygon", points: [[cx - HW, cy - HH], [cx - HW, cy + HH], [cx, cy]], style },
      { kind: "polygon", points: [[cx + HW, cy - HH], [cx + HW, cy + HH], [cx, cy]], style },
    ];
    if (node.label) {
      out.push({ kind: "text", x: cx, y: cy + HH + 16, text: node.label, style: { fill: theme.textMuted, font: "10px ui-sans-serif, system-ui", textAlign: "center" } });
    }
    return out;
  },
};
```

- [ ] **Step 4: 运行确认通过**（3 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/valve.ts src/hmi/symbols/valve.test.ts && git commit -m "feat(hmi): valve symbol with open/closed fill"`

---

## Task 10: 流量计图元

**Files:** Create `src/hmi/symbols/meter.ts`; Test `src/hmi/symbols/meter.test.ts`

- [ ] **Step 1: 写失败测试**

约定：流量计 = 圆 + 内部双 chevron；内联显示 `values.flow` + 单位。

`src/hmi/symbols/meter.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meter } from "./meter";
import { getPalette } from "../engine/theme";

const theme = getPalette("light");
const node = { id: "FT-01", type: "meter", x: 100, y: 100, rotation: 0, label: "FT-01", topics: ["t"], bindings: {}, inline: [] };

describe("meter symbol", () => {
  it("圆形主体", () => {
    const prims = meter.build({ node, state: { values: { flow: 17.2 }, running: false, fault: false, stale: false }, theme });
    assert.ok(prims.some((p) => p.kind === "circle"));
  });
  it("内联显示流量值", () => {
    const prims = meter.build({ node, state: { values: { flow: 17.2 }, running: false, fault: false, stale: false }, theme });
    assert.ok(prims.some((p) => p.kind === "text" && /17\.2/.test((p as { text: string }).text)));
  });
  it("无数据显示占位 --", () => {
    const prims = meter.build({ node, state: { values: {}, running: false, fault: false, stale: true }, theme });
    assert.ok(prims.some((p) => p.kind === "text" && /--/.test((p as { text: string }).text)));
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 meter.ts**

`src/hmi/symbols/meter.ts`:
```ts
import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";

const R = 18;

function fmt(value: unknown): string {
  if (typeof value === "number") return value.toFixed(1);
  const n = Number(value);
  return Number.isNaN(n) ? "--" : n.toFixed(1);
}

export const meter: SymbolDef = {
  type: "meter",
  inlineFields: ["flow"],
  bounds: (node) => ({ x: node.x - R - 2, y: node.y - R - 2, w: (R + 2) * 2, h: (R + 2) * 2 }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const out: Primitive[] = [
      { kind: "circle", cx, cy, r: R, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
      { kind: "polyline", points: [[cx - 6, cy - 6], [cx, cy], [cx - 6, cy + 6]], style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
      { kind: "polyline", points: [[cx, cy - 6], [cx + 6, cy], [cx, cy + 6]], style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
      { kind: "text", x: cx, y: cy + R + 16, text: `${fmt(state.values.flow)} m³/h`, style: { fill: theme.text, font: "600 12px ui-sans-serif, system-ui", textAlign: "center" } },
    ];
    if (node.label) {
      out.push({ kind: "text", x: cx, y: cy - R - 8, text: node.label, style: { fill: theme.textMuted, font: "10px ui-sans-serif, system-ui", textAlign: "center" } });
    }
    return out;
  },
};
```

- [ ] **Step 4: 运行确认通过**（3 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/meter.ts src/hmi/symbols/meter.test.ts && git commit -m "feat(hmi): flow meter symbol"`

---

## Task 11: 边流向解析（model 层）

**Files:** Create `src/hmi/scene/edge-flow.ts`; Test `src/hmi/scene/edge-flow.test.ts`

> 兑现计划A 终审建议：edge.flowBy 的解析放在 model 层，不放绘制层。

- [ ] **Step 1: 写失败测试**

`src/hmi/scene/edge-flow.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEdgeFlow } from "./edge-flow";

const edge = { id: "e1", from: "a", to: "b", points: [[0, 0], [10, 0]] as [number, number][], flowBy: { topic: "t/f", path: "flow" } };

describe("resolveEdgeFlow", () => {
  it("flow > 0 → flowing true", () => {
    assert.equal(resolveEdgeFlow(edge, (t) => (t === "t/f" ? { flow: 5 } : undefined)), true);
  });
  it("flow = 0 → false", () => {
    assert.equal(resolveEdgeFlow(edge, () => ({ flow: 0 })), false);
  });
  it("无 flowBy → false", () => {
    assert.equal(resolveEdgeFlow({ ...edge, flowBy: undefined }, () => ({ flow: 5 })), false);
  });
  it("无数据 → false", () => {
    assert.equal(resolveEdgeFlow(edge, () => undefined), false);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 edge-flow.ts**

`src/hmi/scene/edge-flow.ts`:
```ts
import type { MimicEdge } from "../schema/schema";
import { resolveBinding } from "../data/binding";

/** 边是否有流：flowBy 绑定解析为正数（或真值布尔/字符串）即视为流动。 */
export function resolveEdgeFlow(
  edge: MimicEdge,
  getPayload: (topic: string) => unknown,
): boolean {
  if (!edge.flowBy) return false;
  const v = resolveBinding(getPayload, edge.flowBy);
  if (typeof v === "number") return v > 0;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["1", "true", "on", "yes"].includes(v.toLowerCase()) || Number(v) > 0;
  return false;
}
```

- [ ] **Step 4: 运行确认通过**（4 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/scene/edge-flow.ts src/hmi/scene/edge-flow.test.ts && git commit -m "feat(hmi): edge flow resolution in model layer"`

---

## Task 12: 命中检测

**Files:** Create `src/hmi/engine/hit-test.ts`; Test `src/hmi/engine/hit-test.test.ts`

- [ ] **Step 1: 写失败测试**

`src/hmi/engine/hit-test.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitTest } from "./hit-test";
import { createViewport } from "./viewport";

const boxes = [
  { id: "A", x: 0, y: 0, w: 20, h: 20 },
  { id: "B", x: 100, y: 100, w: 20, h: 20 },
];

describe("hitTest", () => {
  it("1:1 视口，点中 A 框内", () => {
    assert.equal(hitTest(boxes, createViewport(), 10, 10), "A");
  });
  it("点空白返回 null", () => {
    assert.equal(hitTest(boxes, createViewport(), 50, 50), null);
  });
  it("平移视口后命中随之偏移", () => {
    const vp = { scale: 1, x: 100, y: 100 };
    // 屏幕 (110,110) → 世界 (10,10) 命中 A
    assert.equal(hitTest(boxes, vp, 110, 110), "A");
  });
  it("后注册的框在重叠时优先（顶层）", () => {
    const overlap = [
      { id: "below", x: 0, y: 0, w: 50, h: 50 },
      { id: "above", x: 0, y: 0, w: 50, h: 50 },
    ];
    assert.equal(hitTest(overlap, createViewport(), 10, 10), "above");
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 hit-test.ts**

`src/hmi/engine/hit-test.ts`:
```ts
import { toWorld, type Viewport } from "./viewport";

export interface HitBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 屏幕坐标 → 命中的 nodeId（顶层优先），无命中返回 null。 */
export function hitTest(
  boxes: readonly HitBox[],
  vp: Viewport,
  screenX: number,
  screenY: number,
): string | null {
  const { x, y } = toWorld(vp, screenX, screenY);
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return b.id;
    }
  }
  return null;
}
```

- [ ] **Step 4: 运行确认通过**（4 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/engine/hit-test.ts src/hmi/engine/hit-test.test.ts && git commit -m "feat(hmi): hit testing with viewport inverse transform"`

---

## Task 13: 场景渲染组合

**Files:** Create `src/hmi/symbols/scene-render.ts`; Test `src/hmi/symbols/scene-render.test.ts`

> 把 scene + 每节点状态 + 主题 + 选中 组合成完整 `Primitive[]`（管线在底、节点在上、装饰最上），并产出命中框列表。

- [ ] **Step 1: 写失败测试**

`src/hmi/symbols/scene-render.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderScene } from "./scene-render";
import { createRegistry } from "./registry";
import { tank } from "./tank";
import { pump } from "./pump";
import { getPalette } from "../engine/theme";
import { buildScene } from "../scene/scene";
import { parseMimic } from "../schema/schema";

const reg = createRegistry([tank, pump]);
const theme = getPalette("light");
const scene = buildScene(parseMimic({
  meta: { name: "x", version: 1 },
  nodes: [
    { id: "TK-01", type: "tank", x: 100, y: 100, topics: [], bindings: {} },
    { id: "P-01", type: "pump", x: 300, y: 100, topics: [], bindings: {} },
  ],
  edges: [{ id: "e1", from: "TK-01", to: "P-01", points: [[132, 100], [278, 100]] }],
}).data!);

const idleState = () => ({ values: {}, running: false, fault: false, stale: false });

describe("renderScene", () => {
  it("产出图元 + 命中框（每节点一框）", () => {
    const r = renderScene(scene, reg, idleState, () => false, theme);
    assert.ok(r.primitives.length > 0);
    assert.equal(r.hitBoxes.length, 2);
    assert.deepEqual(r.hitBoxes.map((b) => b.id).sort(), ["P-01", "TK-01"]);
  });
  it("选中节点产出选中环", () => {
    const r = renderScene(scene, reg, idleState, (id) => id === "P-01", theme);
    // 选中环是描边 selection 色的 circle
    assert.ok(r.primitives.some((p) => p.kind === "circle" && (p as { style: { stroke?: string } }).style.stroke === theme.selection));
  });
  it("有流的边产出 flow polyline", () => {
    const r = renderScene(scene, reg, idleState, () => false, theme, () => true);
    assert.ok(r.primitives.some((p) => p.kind === "polyline" && (p as { flow?: boolean }).flow === true));
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 scene-render.ts**

`src/hmi/symbols/scene-render.ts`:
```ts
import type { Scene } from "../scene/scene";
import type { NodeState } from "../scene/scene";
import type { MimicEdge } from "../schema/schema";
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";
import type { Registry } from "./registry";
import type { HitBox } from "../engine/hit-test";
import { resolveDecoration } from "./state-language";
import { buildDecoration } from "./decoration";

export interface RenderResult {
  readonly primitives: Primitive[];
  readonly hitBoxes: HitBox[];
}

function edgePrimitive(edge: MimicEdge, theme: Palette, flowing: boolean): Primitive {
  return {
    kind: "polyline",
    points: edge.points.map(([x, y]) => [x, y] as const),
    style: { stroke: theme.stroke, strokeWidth: 4, lineCap: "round" },
    flow: flowing,
  };
}

/**
 * 组合整张场景为图元 + 命中框。
 * 绘制顺序：管线 → 节点主体 → 装饰（环/角标），保证装饰在最上、管线在最下。
 */
export function renderScene(
  scene: Scene,
  registry: Registry,
  getState: (nodeId: string) => NodeState,
  isSelected: (nodeId: string) => boolean,
  theme: Palette,
  isEdgeFlowing?: (edge: MimicEdge) => boolean,
): RenderResult {
  const primitives: Primitive[] = [];
  const hitBoxes: HitBox[] = [];

  for (const edge of scene.edges) {
    primitives.push(edgePrimitive(edge, theme, isEdgeFlowing ? isEdgeFlowing(edge) : false));
  }

  const decorations: Primitive[] = [];
  for (const node of scene.nodes) {
    const def = registry.get(node.type);
    const state = getState(node.id);
    primitives.push(...def.build({ node, state, theme }));
    const b = def.bounds(node);
    hitBoxes.push({ id: node.id, x: b.x, y: b.y, w: b.w, h: b.h });
    const deco = resolveDecoration(state, isSelected(node.id));
    const r = Math.max(b.w, b.h) / 2;
    decorations.push(...buildDecoration(deco, { cx: node.x, cy: node.y, r }, theme));
  }
  primitives.push(...decorations);

  return { primitives, hitBoxes };
}
```

- [ ] **Step 4: 运行确认通过**（3 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/symbols/scene-render.ts src/hmi/symbols/scene-render.test.ts && git commit -m "feat(hmi): compose scene into primitives + hit boxes"`

---

## Task 14: 渲染循环（rAF + 脏标记 + 动画相位）

**Files:** Create `src/hmi/engine/render-loop.ts`; Test `src/hmi/engine/render-loop.test.ts`

> 节能：仅在「脏」或「有活动动画」时重绘；全静止不烧 CPU。相位由时间推进，供 flow/blink 用。注入 `raf`/`now` 以可测。

- [ ] **Step 1: 写失败测试**

`src/hmi/engine/render-loop.test.ts`:
```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRenderLoop } from "./render-loop";

/** 手动驱动的假 rAF。 */
function fakeRaf() {
  let cbs: ((t: number) => void)[] = [];
  const raf = (cb: (t: number) => void) => { cbs.push(cb); return cbs.length; };
  const flush = (t: number) => { const run = cbs; cbs = []; run.forEach((cb) => cb(t)); };
  return { raf, flush, pending: () => cbs.length };
}

describe("createRenderLoop", () => {
  it("脏时调用 render，干净且无动画时不调用", () => {
    const f = fakeRaf();
    let renders = 0;
    const loop = createRenderLoop({ render: () => { renders += 1; }, hasAnimation: () => false, raf: f.raf });
    loop.start();
    loop.markDirty();
    f.flush(16);
    assert.equal(renders, 1);
    f.flush(32); // 不脏、无动画
    assert.equal(renders, 1);
  });
  it("有动画时持续重绘", () => {
    const f = fakeRaf();
    let renders = 0;
    const loop = createRenderLoop({ render: () => { renders += 1; }, hasAnimation: () => true, raf: f.raf });
    loop.start();
    f.flush(16);
    f.flush(32);
    assert.equal(renders, 2);
  });
  it("render 收到的相位随时间在 [0,1) 推进", () => {
    const f = fakeRaf();
    const phases: number[] = [];
    const loop = createRenderLoop({ render: (phase) => phases.push(phase), hasAnimation: () => true, raf: f.raf, periodMs: 1000 });
    loop.start();
    f.flush(0);
    f.flush(500);
    assert.ok(phases[0] >= 0 && phases[0] < 1);
    assert.ok(Math.abs(phases[1] - 0.5) < 0.01);
  });
  it("stop 后不再重绘", () => {
    const f = fakeRaf();
    let renders = 0;
    const loop = createRenderLoop({ render: () => { renders += 1; }, hasAnimation: () => true, raf: f.raf });
    loop.start();
    loop.stop();
    f.flush(16);
    assert.equal(renders, 0);
  });
});
```

- [ ] **Step 2: 运行确认失败**。

- [ ] **Step 3: 实现 render-loop.ts**

`src/hmi/engine/render-loop.ts`:
```ts
export interface RenderLoopOptions {
  /** 重绘回调，phase ∈ [0,1) 供 flow/blink 调制。 */
  render: (phase: number) => void;
  /** 是否存在活动动画（流动/慢闪）。 */
  hasAnimation: () => boolean;
  /** 注入 requestAnimationFrame（测试用假实现）。 */
  raf?: (cb: (t: number) => void) => number;
  /** 动画相位周期（ms），默认 1000。 */
  periodMs?: number;
}

export interface RenderLoop {
  start(): void;
  stop(): void;
  markDirty(): void;
}

export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  const raf = options.raf ?? ((cb) => requestAnimationFrame(cb));
  const period = options.periodMs ?? 1000;
  let running = false;
  let dirty = false;
  let scheduled = false;
  let startTime: number | null = null;

  const schedule = () => {
    if (!running || scheduled) return;
    scheduled = true;
    raf(tick);
  };

  // 用函数声明（提升）以便 schedule 在其上方安全引用。
  function tick(t: number): void {
    scheduled = false;
    if (!running) return;
    if (startTime === null) startTime = t;
    const animating = options.hasAnimation();
    if (dirty || animating) {
      const phase = (((t - startTime) % period) / period + 1) % 1;
      options.render(phase);
      dirty = false;
    }
    // 仅在有动画时自续轮询；全静止则停轮询，等 markDirty() 唤醒（节能：spec §5）。
    // 契约：调用方在状态变化（含动画开始，如管线起流）时必须 markDirty()。
    if (running && options.hasAnimation()) schedule();
  }

  return {
    start() {
      if (running) return;
      running = true;
      startTime = null; // 每次 start 相位归零；动画期间勿反复 start，否则相位跳变
      schedule();
    },
    stop() {
      running = false;
    },
    markDirty() {
      dirty = true;
      schedule();
    },
  };
}
```

- [ ] **Step 4: 运行确认通过**（4 tests）。

- [ ] **Step 5: Commit** — `git add src/hmi/engine/render-loop.ts src/hmi/engine/render-loop.test.ts && git commit -m "feat(hmi): rAF render loop with dirty flag and animation phase"`

---

## Task 15: Canvas Stage（DOM 装配）

**Files:** Create `src/hmi/engine/canvas-stage.ts`（薄 DOM 层；逻辑已在上游测过，stage 由计划C E2E 验证）

- [ ] **Step 1: 实现 canvas-stage.ts**

`src/hmi/engine/canvas-stage.ts`:
```ts
import { paint } from "./painter";
import type { Primitive } from "./primitives";
import type { Viewport } from "./viewport";

export interface CanvasStage {
  /** 用当前视口与相位重绘给定图元。 */
  draw(primitives: readonly Primitive[], vp: Viewport, phase: number): void;
  /** CSS 像素尺寸。 */
  size(): { w: number; h: number };
  destroy(): void;
}

/**
 * 绑定一个 <canvas>，处理 DPR 与尺寸自适应。绘制时按 DPR×视口 设置变换，
 * painter 在世界坐标下绘制。
 */
export function createCanvasStage(
  canvas: HTMLCanvasElement,
  onResize: () => void,
): CanvasStage {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  let dpr = window.devicePixelRatio || 1;

  const applySize = () => {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  };
  applySize();

  const observer = new ResizeObserver(() => {
    applySize();
    onResize();
  });
  observer.observe(canvas);

  return {
    draw(primitives, vp, phase) {
      const rect = canvas.getBoundingClientRect();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.setTransform(dpr * vp.scale, 0, 0, dpr * vp.scale, dpr * vp.x, dpr * vp.y);
      paint(ctx, primitives, phase);
    },
    size() {
      const rect = canvas.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    },
    destroy() {
      observer.disconnect();
    },
  };
}
```

- [ ] **Step 2: 类型检查 + 全量测试 + lint**

Run: `npx tsc --noEmit 2>&1 | grep "src/hmi" || echo "hmi clean"` → Expected: `hmi clean`。
Run: `npm test` → Expected: 全部通过（计划A 26 + 计划B 新增 ≈ 40+ tests）。
Run: `npm run lint` → Expected: `src/hmi` 无新错误（仓库既有的 src 外错误不处理）。

- [ ] **Step 3: Commit** — `git add src/hmi/engine/canvas-stage.ts && git commit -m "feat(hmi): canvas stage with DPR and resize handling"`

---

## 完成标准（计划B Done）

- 引擎（primitives/painter/theme/viewport/hit-test/render-loop/canvas-stage）+ 图元（state-language/registry/decoration/tank/pump/valve/meter/scene-render）+ 边流向（edge-flow）全部就位。
- 纯逻辑全部单测通过（≈40+ tests，`npm test` 全绿），`tsc` 对 src/hmi 零错误。
- 状态语言（深/浅填充、红环慢闪、角标、失联虚线褪色、流向动画）在图元层落地为可测的 IR。
- 未知 type 有占位兜底；edge.flowBy 在 model 层解析。
- Canvas stage 可被计划C 的 React 页面挂载驱动。

## Self-Review 记录

- **Spec 覆盖**：§3 状态语言→state-language + decoration + 各图元填充；§5 数据流（脏标记/相位）→render-loop；Canvas 2D + DPR→canvas-stage；命中→hit-test；pan/zoom/fit→viewport；未知 type 兜底（§8）→registry fallback；edge.flowBy（终审遗留）→edge-flow。仪表全集/电机/风机/过滤器/阻尼器/开关/报警/趋势→后续子项目（明确不在本切片）。
- **占位符**：无 TBD、无占位错误。所有任务的测试与实现签名一致、可直接执行（registry 测试 import 已置顶；tank 无非法 Style 字段；scene-render 签名为 `(scene, registry, getState, isSelected, theme, isEdgeFlowing?)`，测试调用一致）。
- **类型一致**：`Primitive/Style`（Task1）被 painter/symbols/decoration/scene-render 复用；`SymbolDef/SymbolContext/Registry`（Task5）被各图元/scene-render 复用；`Palette`（Task2）贯穿；`NodeState`（计划A scene）被 state-language/symbols 复用；`Viewport`（Task4）被 hit-test/canvas-stage 复用；`HitBox`（Task12）被 scene-render 复用。
- **依赖顺序**：Task1→2→3→4→5 基础；6 依赖 2/3；7-10 依赖 5；11 依赖 A；12 依赖 4；13 依赖 5/6/7-10/3/12；14 独立；15 依赖 1/4/14。建议按编号顺序执行。
