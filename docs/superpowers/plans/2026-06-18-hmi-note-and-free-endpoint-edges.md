# HMI 文字标注（note）+ 管线自由端点 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加一个纯静态文字图元 `note`，并让连线（edge）端点可为「节点」或「画布自由点」，从而忠实还原原图文字标注与「阀控制虚线落进口管」等细节。

**Architecture:** 沿用 schema→scene→primitives→Canvas 单向数据流。`note` 是普通 overlay symbol（文字取 `node.label`，无绑定）。自由端点 = 给 `edgeSchema` 的 `from`/`to` 改可选并加 `fromPoint`/`toPoint`；渲染层 `autoPointsOf` 把每端解析为「节点连接盒」或「零尺寸点盒」，复用现有 `sideRoute`/lead 几何零改写。交互层扩展 HmiCanvas 的拖画/手柄/框选。

**Tech Stack:** TanStack Start 1.x（**不是 Next.js，禁 `next/*`**）、React 19、zod、Canvas 2D、node:test。

## Global Constraints

- **不可变**：所有 schema 变更返回新对象，绝不原地改（见 `edit.ts`）。
- **i18n 同步**：任何新增可见字符串必须 `t()`/`translate()` 包裹并加进 `src/hmi/i18n/dict.ts`（zh-as-key，缺翻译静默回落中文）。设备/用户数据名不翻；UI chrome + 域数据（类目/字段/状态/图例/描述）要翻。
- **测试**：`node:test`，`*.test.ts` co-located；跑 `npm test`，单文件 `node --import tsx --test <file>`。TDD：先写失败测试。
- **验证**：改动文件过 `npx tsc --noEmit` + `npm test` + `npm run lint`；UI 改动用 `npm run dev:preview` + chrome-devtools 截图亲验（查 render 内部用临时 `console.log` 取真值，别靠像素猜）。
- **状态按异常**（DESIGN.md）：note 是中性文字，无异常色（用 `theme.text`/`textMuted` + `halo`）。
- 无 `console.log`，用 `logger`。
- 提交：本仓库有「未让提交别提交」约定——**每个 Task 末尾的 commit 步骤先与用户确认是否提交**；若用户要求暂不提交，则跳过 commit、攒在工作区。

---

# Phase 1 — `note` 静态文字图元

## Task 1: `note` symbol + 单测

**Files:**
- Create: `src/hmi/symbols/note.ts`
- Create: `src/hmi/symbols/note.test.ts`

**Interfaces:**
- Consumes: `SymbolDef`/`SymbolContext`（`src/hmi/symbols/registry.ts`）、`Primitive`（`src/hmi/engine/primitives.ts`）。
- Produces: `export const note: SymbolDef`（`type:"note"`, `overlay:true`, `circular:false`）。文字 = `node.label`，空时占位「文字」。

- [ ] **Step 1: 写失败测试**

`src/hmi/symbols/note.test.ts`：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { note } from "./note";
import { makePalette } from "../engine/theme";
import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";

const theme = makePalette("light");
const emptyState: NodeState = { values: {}, running: false, fault: false, stale: false };
const baseNode = (over: Partial<MimicNode>): MimicNode => ({
  id: "note-1", type: "note", x: 100, y: 50, rotation: 0, label: "进料管线 EG", topics: [], bindings: {}, inline: [], ...over,
});

test("note: 渲染 node.label 文字", () => {
  const prims = note.build({ node: baseNode({}), state: emptyState, theme });
  const txt = prims.find((p) => p.kind === "text");
  assert.ok(txt && txt.kind === "text");
  assert.equal(txt.text, "进料管线 EG");
});

test("note: label 空 → 占位「文字」", () => {
  const prims = note.build({ node: baseNode({ label: undefined }), state: emptyState, theme });
  const txt = prims.find((p) => p.kind === "text");
  assert.ok(txt && txt.kind === "text" && txt.text === "文字");
});

test("note: overlay 且非圆形", () => {
  assert.equal(note.overlay, true);
  assert.equal(note.circular, false);
});

test("note: bounds 随文字长度变宽", () => {
  const short = note.bounds(baseNode({ label: "A" }));
  const long = note.bounds(baseNode({ label: "很长很长很长的标注文字" }));
  assert.ok(long.w > short.w);
});
```

> 注：`makePalette` 若实际导出名不同（如 `getPalette`），改用 `src/hmi/engine/theme.ts` 的真实导出；先 `grep -n "export" src/hmi/engine/theme.ts` 确认。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --import tsx --test src/hmi/symbols/note.test.ts`
Expected: FAIL（`Cannot find module './note'`）。

- [ ] **Step 3: 写最小实现**

`src/hmi/symbols/note.ts`：

```ts
import type { SymbolDef, SymbolContext } from "./registry";
import type { MimicNode } from "../schema/schema";
import type { Primitive } from "../engine/primitives";

const CHAR_W = 8;   // 字符宽估算（无 canvas 测量）
const PAD = 10;     // 盒内左右留白
const HH = 11;      // 半高（命中盒）
const FONT = "600 14px ui-sans-serif, system-ui";

/** 文字标注：纯静态文字（取 node.label），无任何数据绑定。自由摆放，叠在最上层（overlay）。
 *  用于忠实还原原图的介质名/工段名/设计参数等静态文字——区别于绑实时值的 readout。 */
function noteText(node: MimicNode): string {
  const s = node.label?.trim();
  return s && s.length > 0 ? s : "文字";
}

export const note: SymbolDef = {
  type: "note",
  overlay: true,
  circular: false,
  bounds: (node) => {
    const w = noteText(node).length * CHAR_W + PAD * 2;
    return { x: node.x - w / 2, y: node.y - HH, w, h: HH * 2 };
  },
  build: ({ node, theme }: SymbolContext): Primitive[] => [
    // halo（画布色描边）保证压在管线/设备上仍清晰可读
    { kind: "text", x: node.x, y: node.y + 5, text: noteText(node), style: { fill: theme.text, font: FONT, textAlign: "center", halo: theme.canvas } },
  ],
};
```

> 注：确认 `Primitive` 的 `text` 样式支持 `halo`（`instrument.ts buildBox` 用过 `halo: theme.canvas`）；`makeState`/`Palette` 字段以 `theme.ts`/`scene.ts` 真实定义为准。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --import tsx --test src/hmi/symbols/note.test.ts`
Expected: PASS（4 测试）。

- [ ] **Step 5: 提交（先与用户确认）**

```bash
git add src/hmi/symbols/note.ts src/hmi/symbols/note.test.ts
git commit -m "feat(hmi): 文字标注图元 note（纯静态文字，取 node.label，overlay）"
```

## Task 2: 注册 note + capability + i18n + 调色板「标注」类目

**Files:**
- Modify: `src/hmi/symbols/default-registry.ts`（import + 注册 `note`）
- Modify: `src/hmi/symbols/capabilities.ts`（`SymbolCategory` 加「标注」；`CAPABILITIES` 加 `note`）
- Modify: `src/hmi/components/Palette.tsx:20`（`CATEGORIES` 数组加「标注」）
- Modify: `src/hmi/i18n/dict.ts`（补新可见串）
- Modify: `src/hmi/symbols/capabilities.test.ts`（若存在该测试文件则加断言；否则在 `note.test.ts` 加）

**Interfaces:**
- Consumes: Task 1 的 `note`。
- Produces: `CAPABILITIES.note`（`category:"标注"`, `states:[]`）；`SymbolCategory` 含 `"标注"`。

- [ ] **Step 1: 写失败测试**（capability 契约）

在 `src/hmi/symbols/note.test.ts` 追加：

```ts
import { CAPABILITIES } from "./capabilities";

test("note: capability 已登记、类目=标注、无可绑定状态", () => {
  const cap = CAPABILITIES.note;
  assert.ok(cap);
  assert.equal(cap.category, "标注");
  assert.equal(cap.states.length, 0);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --import tsx --test src/hmi/symbols/note.test.ts`
Expected: FAIL（`cap` undefined）。

- [ ] **Step 3: 实现——capabilities.ts**

`src/hmi/symbols/capabilities.ts:33` 改类型：

```ts
export type SymbolCategory = "设备" | "容器" | "换热" | "仪表" | "执行器" | "端子" | "标注";
```

`CAPABILITIES` 对象末尾（`readout` 之后）加：

```ts
  note: { type: "note", label: "文字标注 Note", category: "标注", desc: "纯静态文字标注（介质名/工段名/设计参数等），取显示名为内容，不绑数据；区别于绑实时值的 readout",
    states: [] },
```

- [ ] **Step 4: 实现——注册 + 调色板类目**

`src/hmi/symbols/default-registry.ts`：import 加 `import { note } from "./note";`，`createRegistry([...])` 数组里 `readout,` 后加 `note,`。

`src/hmi/components/Palette.tsx:20`：

```ts
const CATEGORIES: readonly SymbolCategory[] = ["设备", "执行器", "容器", "换热", "仪表", "端子", "标注"];
```

- [ ] **Step 5: 实现——i18n**

`src/hmi/i18n/dict.ts`：在 zh→en 映射对象补这些键（值为英文；沿用文件现有写法）：

```ts
  "标注": "Annotation",
  "文字标注 Note": "Text note",
  "纯静态文字标注（介质名/工段名/设计参数等），取显示名为内容，不绑数据；区别于绑实时值的 readout":
    "Static text annotation (medium/section/spec labels); content = display name, no data binding — unlike the value-bound readout",
```

- [ ] **Step 6: 跑测试 + 类型 + lint**

Run: `node --import tsx --test src/hmi/symbols/note.test.ts && npx tsc --noEmit`
Expected: PASS；tsc 0 错（`SymbolCategory` 加成员后 `Palette`/`capabilities` 一致）。

- [ ] **Step 7: 视觉自检**

`npm run dev:preview` → 编辑态开「元件」库，确认「标注」类目出现、「文字标注 Note」卡片可拖入；拖入后画布显「文字」，选中后在检视面板「显示名」改文字即更新。
（若检视面板「显示名」字段对 `states` 为空的类型被隐藏：到 `src/hmi/components/Inspector.tsx` 找显示名字段的渲染条件，去掉按 states/capability 的门控，让显示名对所有类型常显。）

- [ ] **Step 8: 提交（先确认）**

```bash
git add src/hmi/symbols/default-registry.ts src/hmi/symbols/capabilities.ts src/hmi/components/Palette.tsx src/hmi/i18n/dict.ts src/hmi/symbols/note.test.ts
git commit -m "feat(hmi): 注册 note + 标注类目 + i18n + 调色板卡片"
```

---

# Phase 2 — edge 自由端点（数据 + 渲染）

## Task 3: schema —— 端点可为节点或自由点

**Files:**
- Modify: `src/hmi/schema/schema.ts:124-143`（`edgeSchema`）
- Modify: `src/hmi/schema/edit.test.ts` 或新建 `src/hmi/schema/schema.test.ts`（refine 测试）

**Interfaces:**
- Produces: `MimicEdge` 新增可选 `fromPoint?:[number,number]`/`toPoint?:[number,number]`；`from`/`to` 改 `optional`。约束：每端「节点 id XOR 自由点」恰一。

- [ ] **Step 1: 写失败测试**

新建 `src/hmi/schema/schema.edge.test.ts`：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mimicSchema } from "./schema";

const base = { meta: { name: "t" }, nodes: [], interlocks: [] };
const parseEdge = (edge: unknown) => mimicSchema.safeParse({ ...base, edges: [edge] });

test("edge: 节点→节点 合法", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", to: "B", points: [[0,0],[1,1]] }).success, true);
});
test("edge: 节点→自由点 合法", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", toPoint: [10, 20], points: [[0,0],[1,1]] }).success, true);
});
test("edge: 自由点→自由点 合法", () => {
  assert.equal(parseEdge({ id: "e1", fromPoint: [0,0], toPoint: [10,20], points: [[0,0],[1,1]] }).success, true);
});
test("edge: 一端既给节点又给自由点 → 报错", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", fromPoint: [0,0], to: "B", points: [[0,0],[1,1]] }).success, false);
});
test("edge: 一端两者都不给 → 报错", () => {
  assert.equal(parseEdge({ id: "e1", from: "A", points: [[0,0],[1,1]] }).success, false);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --import tsx --test src/hmi/schema/schema.edge.test.ts`
Expected: FAIL（旧 schema：`from`/`to` 必填、无 `fromPoint`）。

- [ ] **Step 3: 实现 schema**

`src/hmi/schema/schema.ts` 的 `edgeSchema` 改为（替换 124-141 行 `from`/`to` 字段并加 point + refine）：

```ts
export const edgeSchema = z
  .object({
    id: z.string().min(1),
    // 端点：节点 id 或自由点，每端恰选一（见下方 superRefine）
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
    fromPoint: z.tuple([z.number(), z.number()]).optional(),
    toPoint: z.tuple([z.number(), z.number()]).optional(),
    points: z.array(z.tuple([z.number(), z.number()])).min(2),
    flowBy: bindingSchema.optional(),
    lead: z.boolean().optional(),
    auto: z.boolean().optional(),
    fromSide: z.enum(["L", "R", "T", "B"]).optional(),
    toSide: z.enum(["L", "R", "T", "B"]).optional(),
  })
  .superRefine((e, ctx) => {
    if (!!e.from === !!e.fromPoint) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "起点须为节点 id 或自由点，恰选其一" });
    }
    if (!!e.to === !!e.toPoint) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "终点须为节点 id 或自由点，恰选其一" });
    }
  });
export type EdgeSide = NonNullable<z.infer<typeof edgeSchema>["fromSide"]>;
export type MimicEdge = z.infer<typeof edgeSchema>;
```

> `!!e.from === !!e.fromPoint` 为真 = 两者同为真（都给）或同为假（都不给）→ 都判非法。

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `node --import tsx --test src/hmi/schema/schema.edge.test.ts && npm test`
Expected: 5 新测试 PASS；`npm test` 全绿（现有 demo 边为 `from`/`to` 字符串，仍合法）。

- [ ] **Step 5: 提交（先确认）**

```bash
git add src/hmi/schema/schema.ts src/hmi/schema/schema.edge.test.ts
git commit -m "feat(hmi): edge 端点支持节点或自由点（schema + refine）"
```

## Task 4: 渲染 —— autoPointsOf 解析自由点 + edit/validate 兼容

**Files:**
- Modify: `src/hmi/symbols/scene-render.ts`（`autoPointsOf` 完整重构，**替换 Task 3 留下的一行 stopgap** `if (!edge.from || !edge.to) return undefined;`）
- Modify: `src/hmi/symbols/scene-render.test.ts`（新几何断言）
- （可选）`src/hmi/symbols/validate-mimic.test.ts`：补一例「含 `toPoint` 的边不产生悬空告警」，覆盖 Task 3 已加的豁免守卫。

> ⚠️ **范围已缩**：Task 3 为保 tsc 绿，已**前置完成**编译必需的 `edit.ts` undefined 守卫（`moveNodesBy`/`removeNodes`）与 `validate-mimic.ts` 自由点豁免（逻辑已评审正确）。**本 Task 不再改这两文件**，只做 `autoPointsOf` 完整重构（替换 stopgap）+ 渲染测试。

**Interfaces:**
- Consumes: Task 3 的 `MimicEdge`（可选端点）+ scene-render 现有的 `connectBox`/`isCircular`/`sideRoute`。
- Produces: `autoPointsOf` 对 node→point / point→node / point→point 产出正交折线；lead 落自由点终于该点。

- [ ] **Step 1: 写失败测试**

`src/hmi/symbols/scene-render.test.ts` 追加（沿用该文件已有的 `renderScene`/registry/scene 构造帮手；下例为意图，按文件现有 helper 调整）：

```ts
test("renderScene: node→自由点 工艺线 收口到自由点", () => {
  // A 在 (0,0)，自由点 (200,0)；期望折线末端 = [200,0]
  const mimic = parseOk({
    meta: { name: "t" }, interlocks: [],
    nodes: [{ id: "A", type: "tank", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [] }],
    edges: [{ id: "e1", from: "A", toPoint: [200, 0], points: [[0,0],[200,0]] }],
  });
  const { edgePaths } = render(mimic);
  const path = edgePaths.find((p) => p.id === "e1")!;
  const last = path.points[path.points.length - 1];
  assert.deepEqual([Math.round(last[0]), Math.round(last[1])], [200, 0]);
});

test("renderScene: 自由点→自由点 直接两点正交连", () => {
  const mimic = parseOk({
    meta: { name: "t" }, interlocks: [], nodes: [],
    edges: [{ id: "e1", fromPoint: [0,0], toPoint: [100,100], points: [[0,0],[100,100]] }],
  });
  const { edgePaths } = render(mimic);
  const path = edgePaths.find((p) => p.id === "e1")!;
  assert.equal(path.points[0][0], 0);
  assert.equal(path.points[path.points.length - 1][0], 100);
});
```

> 先读 `scene-render.test.ts` 顶部，复用其 `parseOk`/`render`（或等价）helper；若无则按文件现有方式构造 `buildScene`+`renderScene` 并提取 `edgePaths`。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --import tsx --test src/hmi/symbols/scene-render.test.ts`
Expected: FAIL（旧 `autoPointsOf`：`from`/`to` 任一非节点 → 返回 undefined → 回落 `edge.points` 原样，未走正交解析；point→node 时 `scene.byId[undefined]` 取空）。

- [ ] **Step 3: 实现——autoPointsOf 重构**

`src/hmi/symbols/scene-render.ts` 把 `autoPointsOf`（172-201 行）整体替换为：

```ts
  // 端点锚：节点 → 连接盒（端口/中心，贴紧背板）；自由点 → 零尺寸点盒（中心即该点）。
  type EndAnchor = { box: ReturnType<typeof connectBox>; cx: number; cy: number; circular: boolean; side?: MimicEdge["fromSide"] };
  const pointBox = (p: readonly [number, number]) => ({ x: p[0], y: p[1], w: 0, h: 0, cx: p[0], cy: p[1] });
  const resolveEnd = (
    nodeId: string | undefined,
    point: readonly [number, number] | undefined,
    side: MimicEdge["fromSide"],
  ): EndAnchor | undefined => {
    if (point) return { box: pointBox(point), cx: point[0], cy: point[1], circular: false };
    if (nodeId) {
      const n = scene.byId[nodeId];
      if (!n) return undefined;
      const d = registry.get(n.type);
      return { box: connectBox(n, d), cx: n.x, cy: n.y, circular: isCircular(d, n), side };
    }
    return undefined;
  };
  const autoPointsOf = (edge: MimicEdge): readonly (readonly [number, number])[] | undefined => {
    const A = resolveEnd(edge.from, edge.fromPoint, edge.fromSide);
    const B = resolveEnd(edge.to, edge.toPoint, edge.toSide);
    if (!A || !B) return undefined;
    if (edge.lead) {
      // 仪表引线：from=仪表锚点（A.cx/cy），连到 B 中心/自由点（B.cx/cy，深入本体被背板盖住）。
      const fx = A.cx, fy = A.cy;
      const tb = B.box;
      const cx2 = B.cx, cy2 = B.cy;
      const inY = fy >= tb.y && fy <= tb.y + tb.h;
      const inX = fx >= tb.x && fx <= tb.x + tb.w;
      if (inY) return [[fx, fy], [cx2, fy]];
      if (inX) return [[fx, fy], [fx, cy2]];
      return Math.abs(fx - cx2) >= Math.abs(fy - cy2)
        ? [[fx, fy], [cx2, fy], [cx2, cy2]]
        : [[fx, fy], [fx, cy2], [cx2, cy2]];
    }
    // 工艺管线：自由点端无「边」→ 不传 side（零尺寸盒走中心制）。
    return sideRoute(A.box, B.box, A.circular ? undefined : A.side, B.circular ? undefined : B.side);
  };
```

> `connectBox` 已含可选 `cx/cy`，`pointBox` 返回结构与之兼容（含 `cx/cy/w/h`）；如 TS 因返回类型不一致报错，把 `EndAnchor.box` 类型放宽为 `{ x:number;y:number;w:number;h:number;cx?:number;cy?:number }` 并让 `connectBox`/`pointBox` 都满足它。

- [ ] **Step 4: 跑测试确认通过 + 全量**

Run: `node --import tsx --test src/hmi/symbols/scene-render.test.ts && npm test && npx tsc --noEmit`
Expected: 全绿、tsc 0 错（`edit.ts` 守卫 + `validate-mimic` 豁免已在 Task 3 完成，本 Task 不动）。

- [ ] **Step 5: 提交**

```bash
git add src/hmi/symbols/scene-render.ts src/hmi/symbols/scene-render.test.ts
# 若补了 validate-mimic 测试：一并 git add src/hmi/symbols/validate-mimic.test.ts
git commit -m "feat(hmi): autoPointsOf 解析 edge 自由端点（node↔point/point↔point）"
```

## Task 5: addEdge 自由点变体（edit.ts）

**Files:**
- Modify: `src/hmi/schema/edit.ts:201-221`（`addEdge` 重构 + 新 `addEdgeEnds`）
- Modify: `src/hmi/schema/edit.test.ts`（新测试）

**Interfaces:**
- Produces:
  - `export interface EdgeEnd { node?: string; point?: [number, number]; side?: EdgeSide }`
  - `export function addEdgeEnds(mimic: Mimic, from: EdgeEnd, to: EdgeEnd, points: readonly (readonly [number, number])[], lead?: boolean): Mimic`
  - `addEdge(mimic, from: string, to: string, points, sides?, lead?)` 保持签名不变，内部委托 `addEdgeEnds`（HmiPage 现有调用不动）。

- [ ] **Step 1: 写失败测试**

`src/hmi/schema/edit.test.ts` 追加：

```ts
import { addEdgeEnds } from "./edit";

test("addEdgeEnds: 节点→自由点 生成 from + toPoint 边", () => {
  const m0 = parseOk({ meta: { name: "t" }, interlocks: [], edges: [],
    nodes: [{ id: "A", type: "tank", x: 0, y: 0, rotation: 0, topics: [], bindings: {}, inline: [] }] });
  const m1 = addEdgeEnds(m0, { node: "A", side: "R" }, { point: [50, 0] }, [[0,0],[50,0]]);
  const e = m1.edges[0];
  assert.equal(e.from, "A");
  assert.deepEqual(e.toPoint, [50, 0]);
  assert.equal(e.to, undefined);
  assert.equal(e.auto, true);
});

test("addEdgeEnds: 自由点→自由点 + lead", () => {
  const m0 = parseOk({ meta: { name: "t" }, interlocks: [], nodes: [], edges: [] });
  const m1 = addEdgeEnds(m0, { point: [0,0] }, { point: [9,9] }, [[0,0],[9,9]], true);
  assert.equal(m1.edges[0].lead, true);
  assert.deepEqual(m1.edges[0].fromPoint, [0,0]);
});
```

- [ ] **Step 2: 跑确认失败**

Run: `node --import tsx --test src/hmi/schema/edit.test.ts`
Expected: FAIL（`addEdgeEnds` 未导出）。

- [ ] **Step 3: 实现**

`src/hmi/schema/edit.ts` 替换 `addEdge`（201-221）为：

```ts
/** 连线一端：节点 id 或自由点（恰一），节点端可带出/入口方位。 */
export interface EdgeEnd {
  readonly node?: string;
  readonly point?: readonly [number, number];
  readonly side?: EdgeSide;
}

/**
 * 不可变新增连线（端点 = 节点或自由点）。auto=true（渲染按实时位置重算）；points 存当前快照兜底。
 * 两端同一节点（自连）或点数不足 → 原样返回。
 */
export function addEdgeEnds(
  mimic: Mimic,
  from: EdgeEnd,
  to: EdgeEnd,
  points: readonly (readonly [number, number])[],
  lead?: boolean,
): Mimic {
  if ((from.node && from.node === to.node) || points.length < 2) return mimic;
  const edge: MimicEdge = {
    id: nextEdgeId(mimic),
    ...(from.node ? { from: from.node } : {}),
    ...(to.node ? { to: to.node } : {}),
    ...(from.point ? { fromPoint: [from.point[0], from.point[1]] as [number, number] } : {}),
    ...(to.point ? { toPoint: [to.point[0], to.point[1]] as [number, number] } : {}),
    auto: true,
    points: points.map((p) => [p[0], p[1]] as [number, number]),
    ...(lead ? { lead: true } : {}),
    ...(from.side ? { fromSide: from.side } : {}),
    ...(to.side ? { toSide: to.side } : {}),
  };
  return { ...mimic, edges: [...mimic.edges, edge] };
}

/** 旧签名（节点→节点）委托 addEdgeEnds，保持 HmiPage 现有调用不变。 */
export function addEdge(
  mimic: Mimic,
  from: string,
  to: string,
  points: readonly (readonly [number, number])[],
  sides?: { fromSide?: EdgeSide; toSide?: EdgeSide },
  lead?: boolean,
): Mimic {
  if (from === to) return mimic;
  return addEdgeEnds(mimic, { node: from, side: sides?.fromSide }, { node: to, side: sides?.toSide }, points, lead);
}
```

- [ ] **Step 4: 跑确认通过 + 全量**

Run: `node --import tsx --test src/hmi/schema/edit.test.ts && npm test`
Expected: 全绿。

- [ ] **Step 5: 提交（先确认）**

```bash
git add src/hmi/schema/edit.ts src/hmi/schema/edit.test.ts
git commit -m "feat(hmi): addEdgeEnds 支持自由点端点（addEdge 委托复用）"
```

---

# Phase 3 — 创作交互（HmiCanvas + HmiPage）

> 本阶段 React/Canvas 指针层主要靠 E2E（`e2e/hmi.spec.ts`）+ 视觉自检覆盖（与现有约定一致）。每个 Task 完成后 `npm run dev:preview` 亲验。

## Task 6: 拖画落空白 → node→自由点边

**Files:**
- Modify: `src/hmi/components/HmiCanvas.tsx:47`（新 prop `onAddEdgePoint`）, `:420-428`（`commitConnect`）, `:617-625`（pointerup connect 分支）
- Modify: `src/hmi/components/HmiPage.tsx:404-409`（wiring `onAddEdgePoint`）

**Interfaces:**
- Produces: HmiCanvas 新 prop `onAddEdgePoint?: (fromId: string, fromSide: Side, point: [number, number]) => void`；松手落空白时调用。

- [ ] **Step 1: HmiCanvas 加 prop + commitConnect 放行自由端**

`HmiCanvasProps` 加（47 行 `onAddEdge` 之后）：

```ts
  /** 画线落空白：从 fromId 端口拖出、松手在非节点处 → node→自由点边（fromSide=起手方位，point=世界落点）。 */
  onAddEdgePoint?: (fromId: string, fromSide: Side, point: [number, number]) => void;
```

`commitConnect`（420-428）改为：

```ts
  const commitConnect = (fromId: string, fromSide: Side | undefined, sx: number, sy: number) => {
    const toId = hitTest(hitBoxesRef.current, vpRef.current, sx, sy) ?? connectTargetRef.current;
    const w = toWorld(vpRef.current, sx, sy);
    if (toId && toId !== fromId) {
      const fb = hitBoxesRef.current.find((b) => b.id === fromId);
      const tb = hitBoxesRef.current.find((b) => b.id === toId);
      if (!fb || !tb) return;
      const toSide = nearestSide(tb, w);
      propsRef.current.onAddEdge?.(fromId, toId, sideRoute(fb, tb, fromSide, toSide), { fromSide, toSide });
      return;
    }
    // 落空白（无目标节点）→ node→自由点边。需要起手方位走 sideRoute（自由端零尺寸盒）。
    if (toId === fromId) return; // 落回自身 = 取消
    const fb = hitBoxesRef.current.find((b) => b.id === fromId);
    if (!fb || !fromSide) return;
    propsRef.current.onAddEdgePoint?.(fromId, fromSide, [w.x, w.y]);
  };
```

- [ ] **Step 2: HmiPage wiring**

`HmiPage.tsx`（HmiCanvas 的 `onAddEdge` 块 404-409 之后）加：

```tsx
            onAddEdgePoint={editing ? (fromId, fromSide, point) => {
              const isSignal = scene.byId[fromId]?.type === "instrument";
              // 自由端点边：用 addEdgeEnds（from=节点+方位，to=自由点）。引线判定只看源（仪表）。
              history.commit((s) => addEdgeEnds(s, { node: fromId, side: fromSide }, { point }, [
                [scene.byId[fromId]?.x ?? point[0], scene.byId[fromId]?.y ?? point[1]],
                point,
              ], isSignal));
            } : undefined}
```

并在 `HmiPage.tsx:25` 的 import 里把 `addEdge` 一行加上 `addEdgeEnds`。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 0 错。

- [ ] **Step 4: 视觉自检（FIC 进口引线）**

`npm run dev:preview` → 编辑态、选择工具，从某 instrument 气泡的连接点拖出、松手落在某管线/空白处 → 生成一条到该点的边（仪表源 → 虚线）。确认线落在落点、随仪表移动跟随、落点不动。

- [ ] **Step 5: E2E**

`e2e/hmi.spec.ts` 加一例：选择工具下 from 仪表端口 `pointerdown`→移动到空白→`pointerup`，断言 `scene`/DOM 边数 +1（按文件现有断言风格）。

- [ ] **Step 6: 提交（先确认）**

```bash
git add src/hmi/components/HmiCanvas.tsx src/hmi/components/HmiPage.tsx e2e/hmi.spec.ts
git commit -m "feat(hmi): 拖画松手落空白生成 node→自由点连线"
```

## Task 7: 调色板「实线管道 / 虚线引线」线卡片

**Files:**
- Modify: `src/hmi/components/Palette.tsx`（线类专属卡片区）
- Modify: `src/hmi/components/HmiCanvas.tsx`（`placeAtCenter`/`handleDrop` 支持线类型）or 新句柄
- Modify: `src/hmi/components/HmiPage.tsx`（放置线 → addEdgeEnds 默认线段）
- Modify: `src/hmi/i18n/dict.ts`

**Interfaces:**
- Produces: 放置「线」时新建一条两端自由点的默认水平线段（中心附近，长 ~120），lead 由卡片类型决定。

**实现要点（按现有 Palette/Canvas 放置流程并行扩展）：**
- 线不是 symbol（无 capability/registry）。在 `Palette.tsx` 的图元列表**之外**加一个「标注/连线」小节，两枚按钮：「实线管道」「虚线引线」，拖拽载荷用新 MIME `PALETTE_LINE_MIME`（值 `"pipe"`/`"lead"`），点击走新回调 `onPlaceLine(kind)`。
- `HmiCanvas`：`handleDrop` 读到 `PALETTE_LINE_MIME` 时调用 `propsRef.current.onPlaceLine?.(kind, worldPoint)`；`HmiCanvasHandle` 加 `placeLineAtCenter(kind)` 供点击放置。
- `HmiPage`：`onPlaceLine={(kind, p)=>{ const a:[number,number]=[p.x-60,p.y]; const b:[number,number]=[p.x+60,p.y]; history.commit(s=>addEdgeEnds(s,{point:a},{point:b},[a,b], kind==="lead")); }}`。
- i18n 补：「连线」「实线管道」「虚线引线」「拖入画布画一段可调两端的线」+ en。

- [ ] Step 1: 写 E2E 失败用例（拖入「实线管道」→ 边数 +1）。
- [ ] Step 2: 实现 Palette 线卡片 + MIME + 回调。
- [ ] Step 3: 实现 Canvas drop/placeLineAtCenter + HmiPage onPlaceLine。
- [ ] Step 4: i18n 补词。
- [ ] Step 5: `npx tsc --noEmit` + E2E + 视觉自检（拖入实线/虚线各一段）。
- [ ] Step 6: 提交（先确认）：`feat(hmi): 调色板实线管道/虚线引线卡片，放置自由点线段`。

## Task 8: 选中边的两端手柄（拖动移点 / 贴近节点锚定 / 拖离解锚）

**Files:**
- Modify: `src/hmi/components/HmiCanvas.tsx`（渲染叠加层加端点手柄；`dragRef` 加 `"edge-end"` 模式；pointerdown/move/up 处理）
- Modify: `src/hmi/components/HmiPage.tsx`（新增编辑回调 `onSetEdgeEnd`）
- Modify: `src/hmi/schema/edit.ts`（`setEdgeEnd` 编辑 op + 单测）

**Interfaces:**
- Produces:
  - `edit.ts`: `export function setEdgeEnd(mimic: Mimic, edgeId: string, which: "from" | "to", end: EdgeEnd): Mimic`（设某端为节点或自由点，互斥清另一表示，更新对应 `*Side`/`*Point`/`from`/`to`，并刷新 `points` 端点快照）。
  - HmiCanvas: 当 `selectedEdgeId` 命中且编辑态，渲染该边两端实心圆手柄；拖手柄 = 改该端自由点；松手贴近某节点端口（`portHit`）→ 锚为该节点。

- [ ] **Step 1: edit.ts setEdgeEnd 失败测试**

`edit.test.ts`：

```ts
import { setEdgeEnd } from "./edit";

test("setEdgeEnd: 自由点端拖到新坐标", () => {
  const m0 = parseOk({ meta:{name:"t"}, interlocks:[], nodes:[],
    edges:[{ id:"e1", fromPoint:[0,0], toPoint:[10,0], points:[[0,0],[10,0]] }] });
  const m1 = setEdgeEnd(m0, "e1", "to", { point: [99, 5] });
  assert.deepEqual(m1.edges[0].toPoint, [99, 5]);
});

test("setEdgeEnd: 自由点端锚定到节点（清 toPoint，设 to+toSide）", () => {
  const m0 = parseOk({ meta:{name:"t"}, interlocks:[],
    nodes:[{ id:"N", type:"tank", x:0,y:0,rotation:0,topics:[],bindings:{},inline:[] }],
    edges:[{ id:"e1", fromPoint:[0,0], toPoint:[10,0], points:[[0,0],[10,0]] }] });
  const m1 = setEdgeEnd(m0, "e1", "to", { node: "N", side: "L" });
  assert.equal(m1.edges[0].to, "N");
  assert.equal(m1.edges[0].toSide, "L");
  assert.equal(m1.edges[0].toPoint, undefined);
});
```

- [ ] **Step 2: 跑确认失败 → 实现 setEdgeEnd**

`edit.ts`：

```ts
/** 不可变设某条边的某端为节点或自由点（互斥：设节点清 *Point，设自由点清 node+side）。同步 points 端点快照。 */
export function setEdgeEnd(mimic: Mimic, edgeId: string, which: "from" | "to", end: EdgeEnd): Mimic {
  let changed = false;
  const edges = mimic.edges.map((e) => {
    if (e.id !== edgeId) return e;
    changed = true;
    const isFrom = which === "from";
    const idx = isFrom ? 0 : e.points.length - 1;
    const next = { ...e };
    if (end.node) {
      next[isFrom ? "from" : "to"] = end.node;
      delete next[isFrom ? "fromPoint" : "toPoint"];
      if (end.side) next[isFrom ? "fromSide" : "toSide"] = end.side;
    } else if (end.point) {
      next[isFrom ? "fromPoint" : "toPoint"] = [end.point[0], end.point[1]];
      delete next[isFrom ? "from" : "to"];
      delete next[isFrom ? "fromSide" : "toSide"];
      const pts = e.points.map((p, i) => (i === idx ? [end.point![0], end.point![1]] as [number, number] : p));
      next.points = pts;
    }
    return next;
  });
  return changed ? { ...mimic, edges } : mimic;
}
```

> 注意 `MimicEdge` 为 zod 推断只读型；构造 `next` 用浅拷贝 + 受控字段赋值（如 TS 抱怨 `delete`/索引，改用显式重建对象字段）。

- [ ] **Step 3: HmiCanvas 手柄渲染 + 拖拽**
  - 渲染叠加（在 `connect`/`resize` 叠加块附近）：当 `editing && selectedEdgeId` 命中某 `edgePaths` 条目，取其首/末点画两枚实心圆手柄（屏幕常驻尺寸，参照 resize 抓点写法）。
  - `dragRef` mode union 加 `"edge-end"`，并存 `{ edgeId, which: "from"|"to" }`。
  - `handlePointerDown`：在 `portHit`/节点命中之前，先判 `edgeEndHit(sx,sy)`（命中选中边的端点手柄）→ 进 `"edge-end"` 拖拽。
  - `handlePointerMove`（`d.mode==="edge-end"`）：`onSetEdgeEndLive(edgeId, which, [w.x,w.y])`（走 `history.replace` 合一步），首次移动 `onNodesDragStart()`。
  - `handlePointerUp`（`d.mode==="edge-end"`）：松手用 `portHit` 判是否贴近某节点端口；是 → `onSetEdgeEnd(edgeId, which, {node, side})` 锚定；否 → 保持自由点（已在 move 中落）。
  - 新增 props：`onSetEdgeEnd?: (edgeId, which, end) => void`（commit，用于锚定/解锚的终态）与拖拽实时的 `onSetEdgeEndLive?`（replace）。可合并为一个带 `commit:boolean` 的回调以省 prop。

- [ ] **Step 4: HmiPage wiring**

```tsx
  onSetEdgeEnd={editing ? (edgeId, which, end, commit) =>
    (commit ? history.commit : history.replace)((s) => setEdgeEnd(s, edgeId, which, end)) : undefined}
```
（首次移动前 `onNodesDragStart`=`history.begin` 已有，可复用作 edge 拖拽起点。）

- [ ] **Step 5: 校验 + 自检 + E2E**：`tsc` + `npm test`（setEdgeEnd 单测）+ dev:preview 拖端点（移动/锚定/解锚三态）+ E2E。
- [ ] **Step 6: 提交（先确认）**：`feat(hmi): 选中连线两端手柄——拖动改自由点、贴近节点锚定/拖离解锚`。

## Task 9: 选中边「实线 ⇄ 虚线」toggle

**Files:**
- Modify: `src/hmi/schema/edit.ts`（`setEdgeLead` op + 单测）
- Modify: `src/hmi/components/HmiCanvas.tsx` 或新增小浮条组件（选中边时显「设为虚线/实线」按钮）
- Modify: `src/hmi/components/HmiPage.tsx`（wiring）
- Modify: `src/hmi/i18n/dict.ts`

**Interfaces:**
- Produces: `export function setEdgeLead(mimic: Mimic, edgeId: string, lead: boolean): Mimic`。

- [ ] Step 1: `setEdgeLead` 失败测试（设 true 写 `lead:true`，设 false 删 `lead`）。
- [ ] Step 2: 实现 `setEdgeLead`（mapEdge 浅拷贝；false 时省字段）。
- [ ] Step 3: UI——选中边时在边中点附近（或复用 SelectionBar 模式于顶部）显一枚 toggle 按钮，调 `onSetEdgeLead(selectedEdgeId, !currentLead)`。
- [ ] Step 4: HmiPage wiring + i18n（「设为虚线」「设为实线」+ en）。
- [ ] Step 5: `tsc` + `npm test` + 自检（选实线边切虚线，反之）。
- [ ] Step 6: 提交（先确认）：`feat(hmi): 选中连线实线/虚线切换`。

---

# Phase 4 — 边框选 + 整体平移

## Task 10: 选择模型升级为多选边 `selectedEdgeIds`

**Files:**
- Modify: `src/hmi/components/HmiPage.tsx`（`selectedEdgeId: string|null` → `selectedEdgeIds: readonly string[]`；Del/Esc/redrawKey/wiring 同步）
- Modify: `src/hmi/components/HmiCanvas.tsx`（`selectedEdgeId`→`selectedEdgeIds`；`isEdgeSelected` 用 `includes`）

**Interfaces:**
- Produces: 全应用边选择为集合。单击边 → `[id]`；点空白 → `[]`；Del 删除集合内全部边。

- [ ] Step 1: HmiPage 把 `selectedEdgeId` 状态改为 `selectedEdgeids` 数组；`onSelectEdge(id)` → `setSelectedEdgeIds(id?[id]:[])`；`handleCanvasKeyDown` 的 Del 分支 `selectedEdgeIds.length` → `history.commit(s=>selectedEdgeIds.reduce((m,id)=>removeEdge(m,id), s))`；Esc 清；`redrawKey` 用 `selectedEdgeIds.join(",")`。
- [ ] Step 2: HmiCanvas prop 改名 + `isEdgeSelected={(id)=>selectedEdgeIds.includes(id)}`（传入 `selectedEdgeIds`，renderScene 的 `isEdgeSelected` 回调改读它）。`handleClick` 命中边 → `onSelectEdge(edgeId)`（仍单条）。
- [ ] Step 3: `tsc` + 现有 E2E（单选边 + Del）回归通过。
- [ ] Step 4: 提交（先确认）：`refactor(hmi): 边选择升级为多选集合 selectedEdgeIds`。

## Task 11: edit.ts `moveSelectionBy`（节点 + 边自由点整体平移）

**Files:**
- Modify: `src/hmi/schema/edit.ts`（新 op + 单测）

**Interfaces:**
- Produces: `export function moveSelectionBy(mimic: Mimic, nodeIds: readonly string[], edgeIds: readonly string[], dx: number, dy: number): Mimic`——平移选中节点（含其锚连线端点，复用 moveNodesBy 语义），并把选中边的 `fromPoint`/`toPoint`/`points` 各 +（dx,dy）。节点锚端不在此动（渲染自动跟随）。

- [ ] **Step 1: 失败测试**

```ts
import { moveSelectionBy } from "./edit";

test("moveSelectionBy: 平移选中的自由点边", () => {
  const m0 = parseOk({ meta:{name:"t"}, interlocks:[], nodes:[],
    edges:[{ id:"e1", fromPoint:[0,0], toPoint:[10,0], points:[[0,0],[10,0]] }] });
  const m1 = moveSelectionBy(m0, [], ["e1"], 5, 7);
  assert.deepEqual(m1.edges[0].fromPoint, [5, 7]);
  assert.deepEqual(m1.edges[0].toPoint, [15, 7]);
});

test("moveSelectionBy: 节点端不被自由平移（仅自由点动）", () => {
  const m0 = parseOk({ meta:{name:"t"}, interlocks:[],
    nodes:[{ id:"A", type:"tank", x:0,y:0,rotation:0,topics:[],bindings:{},inline:[] }],
    edges:[{ id:"e1", from:"A", toPoint:[10,0], points:[[0,0],[10,0]] }] });
  const m1 = moveSelectionBy(m0, [], ["e1"], 5, 0);
  assert.equal(m1.edges[0].from, "A");        // 节点端不变
  assert.deepEqual(m1.edges[0].toPoint, [15, 0]); // 自由端平移
});
```

- [ ] **Step 2: 跑确认失败 → 实现**

```ts
export function moveSelectionBy(
  mimic: Mimic, nodeIds: readonly string[], edgeIds: readonly string[], dx: number, dy: number,
): Mimic {
  if (dx === 0 && dy === 0) return mimic;
  const moved = nodeIds.length ? moveNodesBy(mimic, nodeIds, dx, dy) : mimic;
  if (edgeIds.length === 0) return moved;
  const eids = new Set(edgeIds);
  const shift = (p: readonly [number, number]) => [p[0] + dx, p[1] + dy] as [number, number];
  const edges = moved.edges.map((e) => {
    if (!eids.has(e.id)) return e;
    return {
      ...e,
      ...(e.fromPoint ? { fromPoint: shift(e.fromPoint) } : {}),
      ...(e.toPoint ? { toPoint: shift(e.toPoint) } : {}),
      points: e.points.map(shift),
    };
  });
  return { ...moved, edges };
}
```

- [ ] **Step 3: 跑确认通过 + 全量**：`node --import tsx --test src/hmi/schema/edit.test.ts && npm test`。
- [ ] **Step 4: 提交（先确认）**：`feat(hmi): moveSelectionBy 节点+自由点边整体平移`。

## Task 12: 框选纳入边 + 拖动整组平移（HmiCanvas + HmiPage）

**Files:**
- Modify: `src/hmi/engine/hit-test.ts` 或 `src/hmi/components/HmiCanvas.tsx`（新 `edgesInMarquee(edgePaths, vp, sx0,sy0,sx1,sy1)`）
- Modify: `src/hmi/components/HmiCanvas.tsx`（marquee 提交并选边；group 拖拽传 edgeIds；边本体可作拖拽起子）
- Modify: `src/hmi/components/HmiPage.tsx`（`onSelectManyEdges`；`onNodesDrag` 改走 `moveSelectionBy` 带 `selectedEdgeIds`）

**Interfaces:**
- Consumes: Task 10 `selectedEdgeIds`、Task 11 `moveSelectionBy`。
- Produces: 框选同时选中相交的边；拖动选区内任一成员 → 节点 + 选中边自由点整体平移。

**实现要点：**
- `edgesInMarquee`：把每条 `EdgePath` 的折线段与世界系选框矩形求相交（任一段相交 / 任一端点在框内 → 命中），返回 edge id 列表。
- `handlePointerUp` 的 `marquee` 分支：除 `onSelectMany(nodes)` 外，调 `propsRef.current.onSelectManyEdges?.(edgesInMarquee(edgePathsRef.current, vp, d.sx0,d.sy0,pos.sx,pos.sy))`。
- group 拖拽：`d.mode==="node"` 的 `onNodesDrag(ids, dx, dy)` 在 HmiPage 改为 `history.replace(s=>moveSelectionBy(s, ids, selectedEdgeIds, dx,dy))`（ids = 选中节点；selectedEdgeIds = 当前选中边）。
- 纯自由线整组（无节点）也能拖：`handlePointerDown` 在命中「选中边的本体」（`hitTestEdges` 命中且在 `selectedEdgeIds` 内）时进 `"node"`-类拖拽但 nodeId 置一个哨兵；更稳的做法是新增 `d.mode==="group"`，move 时 `onGroupDrag(dx,dy)` → HmiPage `moveSelectionBy(s, selectedIds, selectedEdgeIds, dx,dy)`。二选一，保持 ids 来源清晰。

- [ ] Step 1: E2E 失败用例（框选覆盖一条自由线 + 一个节点 → 拖动 → 两者同移）。
- [ ] Step 2: 实现 `edgesInMarquee`（+ 单测：段相交命中）。
- [ ] Step 3: HmiCanvas marquee 选边 + group 拖拽；HmiPage `onSelectManyEdges` + `moveSelectionBy` wiring。
- [ ] Step 4: `tsc` + `npm test` + E2E + 视觉自检（框选含边整体平移；锚端跟随设备）。
- [ ] Step 5: 提交（先确认）：`feat(hmi): 框选纳入连线 + 选区整体平移（含自由点边）`。

---

# Phase 5 — skill 更新

## Task 13: 三个 hmi-* skill 补「文字还原 + 自由端点管线」

**Files:**
- Modify: `.agents/skills/hmi-mimic-generation/SKILL.md`
- Modify: `.agents/skills/hmi-symbol-authoring/SKILL.md`
- Modify: `.agents/skills/hmi-visual-selfcheck/SKILL.md`

**实现要点（无代码，定向补文）：**

- [ ] **Step 1: hmi-mimic-generation** —— 在「照图还原」段补三条：
  1. **文字判别铁律**：原图文字先分两类——实时数值（流量/温度/压力/液位/阀位%）用 `readout`（或 `instrument` box）并绑 topic；静态文字（介质名、工段名「至/来自 XX」、设计参数、设备别名、备注）用 `note`，**不绑数据**。还原 = 位置/朝向/类型 + 图上重要文字都要搬，但**绝不把静态文字当实时值乱绑、也不把实时值做成死 note**。
  2. **自由端点管线**：连线端点可为节点或画布自由点（`fromPoint`/`toPoint`）。还原「阀控制某段管道流量」的细节时，把控制/测量**虚线（lead）落在被控管段上的点**（如阀**左侧进口**管），而非阀中心。实线管道同理可连任意点（off-page 工段桩等）。
  3. **进口 vs 出口 = 两层**：几何层——虚线落进口管段（用自由点钉位）；数值层——气泡仪表（FIC）的 `value` 绑**进口流量计** topic（绑定已支持）。两层都要对，不能只画对线却绑错值。

- [ ] **Step 2: hmi-symbol-authoring** —— 加「无绑定标注类图元」登记规范：新图元三件套（`symbol.ts` + `capabilities.ts` 条目 + `i18n/dict.ts` + `*.test.ts`）；`note` 为范例——`overlay:true`、`states:[]`、文字取 `node.label`、`circular:false`。强调新类目要同步加进 `capabilities.ts` 的 `SymbolCategory` 与 `Palette.tsx` 的 `CATEGORIES`。

- [ ] **Step 3: hmi-visual-selfcheck** —— 自检清单加三项：①原图重要文字是否都还原；②每处文字是否判对 `note`（静态）vs `readout`（实时）；③控制/测量引线是否落在**正确管段**（进口 vs 出口）、随仪表移动跟随、自由端不动。

- [ ] **Step 4: 提交（先确认）**：`docs(skills): 文字还原判别铁律 + 自由端点管线 + 进口/出口两层`。

---

## Self-Review（计划自检结论）

- **Spec 覆盖**：Part 1 note→Task 1-2；判别铁律→Task 13.1。Part 2 schema→Task 3、render→Task 4、addEdge→Task 5、交互(拖画/卡片/手柄/lead toggle)→Task 6-9、进口/出口两层→Task 13.1.3、group-move(用户加项)→Task 10-12、skill→Task 13。无遗漏。
- **占位扫描**：Phase 1-2、Task 8/11 含完整测试+实现代码；Task 7/9/12 为 UI/E2E 任务，给了精确文件+函数+接口契约+分步骤（指针层按仓库惯例靠 E2E+自检，与现有约定一致），非「TODO」。
- **类型一致**：`EdgeEnd`/`addEdgeEnds`/`setEdgeEnd`/`setEdgeLead`/`moveSelectionBy`/`selectedEdgeIds`/`onAddEdgePoint` 跨 Task 命名统一；`MimicEdge` 可选端点贯穿 render/edit/validate。
- **风险点**：①`MimicEdge` 为 zod 只读推断型，`setEdgeEnd`/`setEdgeLead` 里 `delete`/索引赋值可能触发 TS——必要时显式重建对象字段（已在注中标）。②`theme`/`Primitive.halo`/`scene-render.test.ts` helper 的真实名以源码为准（已标 grep 确认）。③Inspector 显示名字段对 `states:[]` 类型是否常显需 Task 2 Step 7 验证。
