# 设备动作按钮 实现计划（Plan 1/2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**TL;DR（给评审者）**：给设备配"动作"，设备下方自动长出胶囊按钮（≤3 全显示，≥4 前 2 个 + ⋯ 菜单）；operator 预览点按钮发 MQTT（可选确认弹窗、按钮原位"✓ 已发送"），admin 在 Inspector「操作」分节配置（实时预览、试发送）。同时删掉 B-P0 三个独立控制图元、PublishPanel 和底部告警条。

**Goal:** 实现 spec（`docs/superpowers/specs/2026-06-11-device-action-buttons-and-symbol-refinement-design.md`）第 1 部分 + §3.3 告警条移除。

**Architecture:** 按钮 = 节点属性（`node.actions`）。渲染层纯函数布局（`symbols/action-buttons.ts`）→ `scene-render` 输出独立 `actionHitBoxes` → `HmiCanvas` 命中优先按钮并按模式分流（编辑=选中、预览=执行）→ `HmiPage` 持执行链路（publish + 乐观回显 + 反馈）与溢出菜单 React 浮层。

**Tech Stack:** 既有栈——zod schema、不可变 edit、Canvas 2D 图元 IR、node:test、Playwright。

**全局约定**：
- 测试跑法：`node --import tsx --test <file>`；全量 `npm test`；类型 `npx tsc --noEmit`
- 所有用户可见新字符串必须同步 `src/hmi/i18n/dict.ts`（zh-as-key）——Task 12 统一核对
- 每个 Task 结束 commit；commit message 用 conventional commits，不带 attribution

---

### Task 1: schema——`node.actions` 替换 `node.control`

**Files:**
- Modify: `src/hmi/schema/schema.ts`
- Modify: `src/hmi/schema/schema.test.ts`

- [ ] **Step 1: 写失败测试**——替换 schema.test.ts 末尾整个 `describe("control 控制元件配置", …)` 块为：

```ts
describe("actions 设备动作", () => {
  const node = (actions: unknown) => ({
    meta: { name: "m" },
    nodes: [{ id: "p1", type: "pump", x: 0, y: 0, actions }],
  });

  it("合法动作列表通过（label+items+confirm）", () => {
    const r = parseMimic(node([
      { label: "启动", items: [{ topic: "cmd/run", template: '{"run":1}' }], confirm: true },
      { label: "停止", items: [{ topic: "cmd/run", template: '{"run":0}' }] },
    ]));
    assert.ok(r.ok, r.error);
    assert.equal(r.data!.nodes[0].actions?.length, 2);
    assert.equal(r.data!.nodes[0].actions?.[0].confirm, true);
  });

  it("空 label / 空 items 拒绝", () => {
    assert.equal(parseMimic(node([{ label: "", items: [{ topic: "t", template: "{}" }] }])).ok, false);
    assert.equal(parseMimic(node([{ label: "启动", items: [] }])).ok, false);
  });

  it("超过 8 个动作拒绝", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ label: `a${i}`, items: [{ topic: "t", template: "{}" }] }));
    assert.equal(parseMimic(node(nine)).ok, false);
  });

  it("未配置 actions 的节点不受影响；带旧 control 字段的数据被剥离不报错", () => {
    const r = parseMimic({ meta: { name: "m" }, nodes: [{ id: "p", type: "pump", x: 0, y: 0, control: { press: {} } }] });
    assert.ok(r.ok);
    assert.equal(r.data!.nodes[0].actions, undefined);
    assert.equal((r.data!.nodes[0] as Record<string, unknown>).control, undefined);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**——`node --import tsx --test src/hmi/schema/schema.test.ts`，预期 FAIL（actions 字段不存在）
- [ ] **Step 3: 改 schema.ts**——删除「控制元件」整节（`controlActionSchema`/`controlWriteSchema`/`controlSchema` 及其类型导出），原位替换为：

```ts
// ───────────── 设备动作（操作→写值，与 bindings 数据→外观严格分离） ─────────────

/**
 * 设备动作：渲染为停靠在设备下方的胶囊按钮。label=按钮文字；items=点击时逐条发布的消息组；
 * confirm=发送前二次确认。列表顺序即优先级：≤3 个全部直达，≥4 个前 2 个直达、其余收进 ⋯ 菜单。
 */
export const deviceActionSchema = z.object({
  label: z.string().min(1),
  items: z.array(publishMessageSchema).min(1),
  confirm: z.boolean().optional(),
});
export type DeviceAction = z.infer<typeof deviceActionSchema>;

/** 单设备动作上限：防按钮/菜单失控（fail-fast）。 */
export const MAX_NODE_ACTIONS = 8;
```

node 内 `control: controlSchema.optional(),` 替换为：

```ts
  /** 设备动作按钮：预览模式点击执行（发 MQTT）。缺省视为无按钮。 */
  actions: z.array(deviceActionSchema).max(MAX_NODE_ACTIONS).optional(),
```

- [ ] **Step 4: 跑测试通过**——同 Step 2 命令，预期 PASS（此时仓库其他文件 tsc 会红，属预期，后续任务清理）
- [ ] **Step 5: Commit**——`git add src/hmi/schema/ && git commit -m "feat(hmi): schema 用 node.actions 设备动作替换 node.control"`

### Task 2: edit.ts——`setNodeActions` 替换 `setNodeControl`

**Files:**
- Modify: `src/hmi/schema/edit.ts`
- Modify: `src/hmi/schema/edit.test.ts`

- [ ] **Step 1: 写失败测试**——edit.test.ts 中整个 `describe("setNodeControl (不可变)", …)` 块替换为（同时把顶部 import 里 `setNodeControl` 改为 `setNodeActions`）：

```ts
describe("setNodeActions (不可变)", () => {
  const actions = [{ label: "启动", items: [{ topic: "cmd/run", template: '{"run":1}' }] }];
  it("整列表替换（原 mimic 不变）", () => {
    const next = setNodeActions(base, "P-01", actions);
    assert.deepEqual(next.nodes[0].actions, actions);
    assert.equal(base.nodes[0].actions, undefined);
  });
  it("空列表/undefined 清除字段", () => {
    const a = setNodeActions(base, "P-01", actions);
    assert.equal(setNodeActions(a, "P-01", []).nodes[0].actions, undefined);
    assert.equal(setNodeActions(a, "P-01", undefined).nodes[0].actions, undefined);
  });
  it("节点不存在 → 原样返回", () => {
    assert.equal(setNodeActions(base, "NOPE", actions), base);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**——`node --import tsx --test src/hmi/schema/edit.test.ts`
- [ ] **Step 3: 改 edit.ts**——import 行 `Control` 改 `DeviceAction`；`setNodeControl` 函数替换为：

```ts
/** 不可变整列表替换设备动作（增删改排序由 UI 组装新列表后一次提交；空列表即清除）。 */
export function setNodeActions(mimic: Mimic, nodeId: string, actions: readonly DeviceAction[] | undefined): Mimic {
  return mapNode(mimic, nodeId, (node) => ({
    ...node,
    actions: actions && actions.length > 0 ? [...actions] : undefined,
  }));
}
```

- [ ] **Step 4: 跑测试通过**，**Step 5: Commit** `git add src/hmi/schema/ && git commit -m "feat(hmi): setNodeActions 不可变编辑"`

### Task 3: 执行纯函数迁移——`data/payload.ts`，删 `data/control.ts`

**Files:**
- Create: `src/hmi/data/payload.ts`、`src/hmi/data/payload.test.ts`
- Delete: `src/hmi/data/control.ts`、`src/hmi/data/control.test.ts`

- [ ] **Step 1: 写 payload.test.ts**（失败测试）：

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePayload } from "./payload";

describe("parsePayload", () => {
  it("合法 JSON → 解析对象", () => assert.deepEqual(parsePayload('{"run":1}'), { run: 1 }));
  it("非 JSON → 原始字符串", () => assert.equal(parsePayload("START"), "START"));
});
```

- [ ] **Step 2: 跑确认失败**——`node --import tsx --test src/hmi/data/payload.test.ts`
- [ ] **Step 3: 写 payload.ts**：

```ts
/** payload 模板解析：合法 JSON 按 JSON 发，否则按原始字符串发（MQTT payload 可为纯文本）。 */
export function parsePayload(template: string): unknown {
  try {
    return JSON.parse(template);
  } catch {
    return template;
  }
}
```

- [ ] **Step 4: 删旧文件**——`git rm src/hmi/data/control.ts src/hmi/data/control.test.ts`（resolveControlClick/renderWritePayload/validateWriteValue/CONTROL_TYPES 随独立控制图元废弃，不迁移）
- [ ] **Step 5: 跑测试通过 + Commit**——`git add src/hmi/data/ && git commit -m "refactor(hmi): parsePayload 迁至 data/payload.ts，删除控制图元执行模块"`

### Task 4: 删三个控制 symbol 与品类

**Files:**
- Delete: `src/hmi/symbols/pushbutton.ts`、`toggle.ts`、`setpoint.ts`、`control-symbols.test.ts`
- Modify: `src/hmi/symbols/capabilities.ts`、`src/hmi/symbols/default-registry.ts`、`src/hmi/components/Palette.tsx`

- [ ] **Step 1: 删文件**——`git rm src/hmi/symbols/pushbutton.ts src/hmi/symbols/toggle.ts src/hmi/symbols/setpoint.ts src/hmi/symbols/control-symbols.test.ts`
- [ ] **Step 2: capabilities.ts**——`SymbolCategory` 去掉 `| "操作"`；删除 pushbutton/toggle/setpoint 三个条目（从 `pushbutton: {` 起到 `cyclone:` 前的空行止）
- [ ] **Step 3: default-registry.ts**——删 3 个 import 与注册数组里的 `pushbutton, toggle, setpoint,`；注释回退为原文案（去掉「+ 操作（控制元件）」）
- [ ] **Step 4: Palette.tsx**——`CATEGORIES` 数组去掉 `"操作"`
- [ ] **Step 5: 验证 + Commit**——`node --import tsx --test src/hmi/symbols/default-registry.test.ts src/hmi/symbols/capabilities*.test.ts 2>/dev/null; npm test 2>&1 | tail -4`（symbols 层应全绿；components 层 tsc 红留给 Task 8-11）。`git add -A src/hmi/symbols src/hmi/components/Palette.tsx && git commit -m "refactor(hmi): 移除独立控制图元三件套与「操作」品类"`

### Task 5: `symbols/action-buttons.ts`——布局/分配/命中纯函数

**Files:**
- Create: `src/hmi/symbols/action-buttons.ts`、`src/hmi/symbols/action-buttons.test.ts`

- [ ] **Step 1: 写失败测试**（核心断言，完整文件）：

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitActions, truncateLabel, estimateTextWidth, layoutActionButtons, hitTestActionButtons, buildActionButtons } from "./action-buttons";
import { getPalette } from "../engine/theme";
import type { MimicNode, DeviceAction } from "../schema/schema";

const theme = getPalette("light");
const mkNode = (n: number): MimicNode => ({
  id: "P1", type: "pump", x: 100, y: 100, rotation: 0, label: "P1", topics: [], bindings: {}, inline: [],
  actions: Array.from({ length: n }, (_, i) => ({ label: `动作${i + 1}`, items: [{ topic: "t", template: "{}" }] })) as DeviceAction[],
});
const bounds = { x: 76, y: 76, w: 48, h: 48 };

describe("splitActions", () => {
  it("≤3 全直达无溢出", () => {
    assert.deepEqual(splitActions(3), { direct: [0, 1, 2], overflow: [] });
    assert.deepEqual(splitActions(1), { direct: [0], overflow: [] });
  });
  it("≥4 前 2 直达其余溢出", () => {
    assert.deepEqual(splitActions(4), { direct: [0, 1], overflow: [2, 3] });
    assert.deepEqual(splitActions(8).overflow.length, 6);
  });
});

describe("truncateLabel / estimateTextWidth", () => {
  it("≤6 字原样，超长截断加 …", () => {
    assert.equal(truncateLabel("启动"), "启动");
    assert.equal(truncateLabel("一二三四五六七"), "一二三四五六…");
  });
  it("CJK 比西文宽", () => {
    assert.ok(estimateTextWidth("启动") > estimateTextWidth("GO"));
  });
});

describe("layoutActionButtons", () => {
  it("3 个动作 → 3 个直达盒（无 overflow 盒），整行水平居中于 node.x", () => {
    const boxes = layoutActionButtons(mkNode(3), bounds, true, false);
    assert.equal(boxes.length, 3);
    assert.ok(boxes.every((b) => b.action !== "overflow"));
    const left = boxes[0].x;
    const right = boxes[2].x + boxes[2].w;
    assert.ok(Math.abs((left + right) / 2 - 100) < 1, "按钮行中心≈node.x");
  });
  it("5 个动作 → 2 直达 + overflow 盒", () => {
    const boxes = layoutActionButtons(mkNode(5), bounds, true, false);
    assert.equal(boxes.length, 3);
    assert.equal(boxes[2].action, "overflow");
  });
  it("y 起点 = bounds 底 + 标签/内联占位 + 间距；无标签时更靠上", () => {
    const withLabel = layoutActionButtons(mkNode(1), bounds, true, true)[0];
    const noLabel = layoutActionButtons(mkNode(1), bounds, false, false)[0];
    assert.ok(withLabel.y > noLabel.y);
    assert.ok(noLabel.y >= bounds.y + bounds.h);
  });
  it("无动作 → 空数组", () => {
    assert.deepEqual(layoutActionButtons({ ...mkNode(1), actions: undefined }, bounds, true, false), []);
  });
});

describe("hitTestActionButtons", () => {
  it("命中盒内坐标返回该盒，盒外 null", () => {
    const boxes = layoutActionButtons(mkNode(2), bounds, true, false);
    const b = boxes[1];
    assert.equal(hitTestActionButtons(boxes, b.x + 2, b.y + 2), b);
    assert.equal(hitTestActionButtons(boxes, 0, 0), null);
  });
});

describe("buildActionButtons", () => {
  it("每盒产出胶囊 rect + 文字；sent 态用 running 配色", () => {
    const boxes = layoutActionButtons(mkNode(2), bounds, true, false);
    const prims = buildActionButtons(boxes, theme, (b) => (b.action === 0 ? "sent" : "idle"));
    const rects = prims.filter((p) => p.kind === "rect") as { style: { fill?: string } }[];
    assert.equal(rects.length, 2);
    assert.equal(rects[0].style.fill, theme.running);
    assert.ok(prims.some((p) => p.kind === "text"));
  });
});
```

- [ ] **Step 2: 跑确认失败**——`node --import tsx --test src/hmi/symbols/action-buttons.test.ts`
- [ ] **Step 3: 写 action-buttons.ts**（完整实现）：

```ts
import type { MimicNode } from "../schema/schema";
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";

/** 直达/溢出规则：≤3 全直达；≥4 前 MAX_DIRECT 个直达、其余进 ⋯ 菜单（溢出只剩 1 个不值得占 ⋯ 位）。 */
const MAX_DIRECT = 2;
const MAX_NO_OVERFLOW = 3;
const BTN_H = 18;
const BTN_R = 9;
const GAP = 4;
const PAD_X = 8;
const MAX_CHARS = 6;
const FONT = "10px ui-sans-serif, system-ui";
/** 行起点距 bounds 底边的额外间距（在标签/内联行之后）。 */
const ROW_GAP = 6;
const LABEL_H = 16;
const INLINE_H = 14;

export type ActionVisual = "idle" | "pressed" | "sent";

export interface ActionButtonBox {
  readonly nodeId: string;
  /** 动作下标；"overflow" = ⋯ 溢出按钮。 */
  readonly action: number | "overflow";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 渲染文字（已截断；overflow 恒为 "⋯"）。 */
  readonly text: string;
}

export function splitActions(count: number): { direct: number[]; overflow: number[] } {
  const all = Array.from({ length: count }, (_, i) => i);
  if (count <= MAX_NO_OVERFLOW) return { direct: all, overflow: [] };
  return { direct: all.slice(0, MAX_DIRECT), overflow: all.slice(MAX_DIRECT) };
}

/** 估算文字宽：CJK ~10px/字、其余 ~6px/字（10px 字号；布局期拿不到 ctx.measureText）。 */
export function estimateTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += /[⺀-鿿豈-﫿＀-￯]/.test(ch) ? 10 : 6;
  return w;
}

/** 超过 MAX_CHARS 个字符截断加 …（按钮 title 全文由浮层/检视承担，画布不悬停出全文）。 */
export function truncateLabel(label: string): string {
  const chars = [...label];
  return chars.length <= MAX_CHARS ? label : `${chars.slice(0, MAX_CHARS).join("")}…`;
}

/**
 * 停靠布局：按钮行在 bounds 底边 → 标签行(若有) → 内联行(若有) → ROW_GAP 之下，整行水平居中于 node.x。
 * 返回世界坐标盒（含 ⋯）。无动作返回空数组。
 */
export function layoutActionButtons(
  node: MimicNode,
  bounds: { x: number; y: number; w: number; h: number },
  hasLabel: boolean,
  hasInline: boolean,
): ActionButtonBox[] {
  const actions = node.actions ?? [];
  if (actions.length === 0) return [];
  const { direct, overflow } = splitActions(actions.length);
  const entries = [
    ...direct.map((i) => ({ action: i as number | "overflow", text: truncateLabel(actions[i].label) })),
    ...(overflow.length > 0 ? [{ action: "overflow" as const, text: "⋯" }] : []),
  ];
  const widths = entries.map((e) => Math.max(BTN_H, estimateTextWidth(e.text) + PAD_X * 2));
  const totalW = widths.reduce((a, b) => a + b, 0) + GAP * (entries.length - 1);
  const y = bounds.y + bounds.h + (hasLabel ? LABEL_H : 0) + (hasInline ? INLINE_H : 0) + ROW_GAP;
  let x = node.x - totalW / 2;
  return entries.map((e, i) => {
    const box: ActionButtonBox = { nodeId: node.id, action: e.action, x, y, w: widths[i], h: BTN_H, text: e.text };
    x += widths[i] + GAP;
    return box;
  });
}

/** 按钮命中（世界坐标，倒序遍历取最上层）。未命中 null。 */
export function hitTestActionButtons(boxes: readonly ActionButtonBox[], wx: number, wy: number): ActionButtonBox | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) return b;
  }
  return null;
}

/** 胶囊绘制：idle=浅底描边；pressed=深底；sent=运行绿底白字「✓ 已发送」由调用方换 text。 */
export function buildActionButtons(
  boxes: readonly ActionButtonBox[],
  theme: Palette,
  visualOf: (box: ActionButtonBox) => ActionVisual,
): Primitive[] {
  const out: Primitive[] = [];
  for (const b of boxes) {
    const visual = visualOf(b);
    const fill = visual === "sent" ? theme.running : visual === "pressed" ? theme.fillDeep : theme.fillLight;
    const textFill = visual === "idle" ? theme.text : theme.badgeFg;
    out.push(
      { kind: "rect", x: b.x, y: b.y, w: b.w, h: b.h, r: BTN_R, style: { fill, stroke: theme.stroke, strokeWidth: 1.25 } },
      { kind: "text", x: b.x + b.w / 2, y: b.y + b.h / 2 + 3.5, text: visual === "sent" ? "✓" : b.text, style: { fill: textFill, font: FONT, textAlign: "center" } },
    );
  }
  return out;
}
```

- [ ] **Step 4: 跑测试通过**，**Step 5: Commit** `git add src/hmi/symbols/action-buttons* && git commit -m "feat(hmi): 动作按钮布局/分配/命中/绘制纯函数"`

### Task 6: scene-render 集成按钮渲染与 actionHitBoxes

**Files:**
- Modify: `src/hmi/symbols/scene-render.ts`
- Modify: `src/hmi/symbols/scene-render.test.ts`

- [ ] **Step 1: 写失败测试**——scene-render.test.ts 追加：

```ts
describe("动作按钮渲染", () => {
  it("带 actions 的节点输出 actionHitBoxes；无 actions 不输出", () => {
    // 按该测试文件现有 scene 构造模式，给一个节点加
    // actions: [{ label: "启动", items: [{ topic: "t", template: "{}" }] }]
    // 断言 renderScene(...).actionHitBoxes.length === 1 且 nodeId 正确；
    // 另一无 actions 节点不产生盒。
  });
  it("失联节点的按钮不被虚化（按钮是 UI 不是设备状态）", () => {
    // stale 状态节点带 actions：actionHitBoxes 仍存在，
    // 且按钮 rect 的 opacity 未被乘 STALE_OPACITY（检查 primitives 中按钮 rect style.opacity === undefined）。
  });
});
```

（具体 scene 构造沿用该文件既有 helper；两个 `it` 必须真实实现，不留注释占位——执行者按文件内现有模式补全构造代码。）

- [ ] **Step 2: 跑确认失败**
- [ ] **Step 3: 改 scene-render.ts**：
  - import 增：`import { layoutActionButtons, buildActionButtons, type ActionButtonBox, type ActionVisual } from "./action-buttons";` 与 `import { inlineLine } from "./inline";`
  - `RenderResult` 增 `readonly actionHitBoxes: ActionButtonBox[];`
  - `renderScene` 签名追加最后一个可选参数 `getActionVisual?: (nodeId: string, action: number | "overflow") => ActionVisual`
  - 节点循环内（`decorations.push(...)` 之后）追加：

```ts
    if (node.actions?.length) {
      const boxes = layoutActionButtons(node, b, !!node.label, inlineLine(node, state) !== null);
      actionHitBoxes.push(...boxes);
      decorations.push(...buildActionButtons(boxes, theme, (box) => getActionVisual?.(box.nodeId, box.action) ?? "idle"));
    }
```

  - 函数头部声明 `const actionHitBoxes: ActionButtonBox[] = [];`，return 改为 `{ primitives, hitBoxes, actionHitBoxes }`
- [ ] **Step 4: 跑测试通过**（`node --import tsx --test src/hmi/symbols/scene-render.test.ts`），**Step 5: Commit** `git commit -am "feat(hmi): renderScene 输出动作按钮图元与命中盒"`

### Task 7: HmiCanvas——命中优先级与模式分流

**Files:**
- Modify: `src/hmi/components/HmiCanvas.tsx`

> 本组件无单测（Canvas 指针层由 E2E 覆盖，Task 13）。改完以 `npx tsc --noEmit` 为绿灯。

- [ ] **Step 1: props 扩展**——`HmiCanvasProps` 增：

```ts
  /** 预览模式点击直达动作按钮（编辑模式命中按钮走 onSelect 选中设备配置）。 */
  onActionClick?: (nodeId: string, actionIndex: number) => void;
  /** 预览模式点击 ⋯ 溢出按钮：anchor 为该按钮右下角的屏幕坐标（浮层菜单定位用）。 */
  onActionOverflow?: (nodeId: string, anchorX: number, anchorY: number) => void;
  /** 按钮视觉态注入（pressed 由本组件内部管理，sent 由上层反馈状态驱动）。 */
  getActionFeedback?: (nodeId: string, actionIndex: number) => boolean;
```

- [ ] **Step 2: 接 renderScene**——组件内找到调用 `renderScene(...)` 处（渲染回调），把内部 pressed 引用与 props 反馈合成视觉态传入：

```ts
const pressedActionRef = useRef<{ nodeId: string; action: number | "overflow" } | null>(null);
// renderScene(..., (nodeId, action) => {
//   const p = pressedActionRef.current;
//   if (p && p.nodeId === nodeId && p.action === action) return "pressed";
//   if (typeof action === "number" && getActionFeedback?.(nodeId, action)) return "sent";
//   return "idle";
// })
```

  结果里的 `actionHitBoxes` 存入 `actionBoxesRef`（与现有 `hitBoxes` ref 同模式）。
- [ ] **Step 3: 指针分流**——在现有 pointerdown/pointerup 命中逻辑**之前**插入按钮判定（世界坐标用现有 `toWorld` 换算）：
  - pointerdown：`hitTestActionButtons(actionBoxesRef.current, wx, wy)` 命中 → 记 `pressedActionRef` + 触发重绘，并**不**进入节点拖拽/选择流程（return）
  - pointerup：若 `pressedActionRef` 非空且仍命中同一盒：编辑态（`tool` 可用即编辑）→ `onSelect(box.nodeId)`；预览态 → `box.action === "overflow" ? onActionOverflow?.(box.nodeId, …toScreen(box.x + box.w, box.y + box.h))` : `onActionClick?.(box.nodeId, box.action)`。清 `pressedActionRef` + 重绘
  - pointermove：命中按钮时 `canvas.style.cursor = "pointer"`（已有 cursor 管理处并入）
- [ ] **Step 4: 验证**——`npx tsc --noEmit` 通过（HmiPage 还未传新 props，可选 props 不报错）
- [ ] **Step 5: Commit**——`git commit -am "feat(hmi): 画布命中优先动作按钮，编辑选中/预览执行分流"`

### Task 8: ControlDialog 瘦身（仅保留 confirm 模式）

**Files:**
- Modify: `src/hmi/components/ControlDialog.tsx`

- [ ] **Step 1: 删 setpoint 模式**——`ControlDialogRequest` 只留 `{ kind: "confirm"; title; message; confirmLabel }`；删除数值输入分支、`validateWriteValue` import（模块已删）、`ControlWrite` 类型引用与 setpoint 相关 state/JSX；`onConfirm` 签名简化为 `() => void`
- [ ] **Step 2: 验证 + Commit**——`npx tsc --noEmit`（HmiPage 引用处 Task 11 同步改，此刻若报 HmiPage 错误属预期，仅确认 ControlDialog 自身无误）。`git commit -am "refactor(hmi): ControlDialog 仅保留确认模式"`

### Task 9: ActionsEditor（替代 ControlEditor）

**Files:**
- Create: `src/hmi/components/ActionsEditor.tsx`
- Delete: `src/hmi/components/ControlEditor.tsx`

> 结构遵循 spec §1 易用性原则与 §2.5。本组件无单测（节点逻辑全在纯函数层），以 tsc + E2E + 浏览器验收。

- [ ] **Step 1: 写组件**（完整骨架，样式 className 沿用仓库既有 token 写法）：

```tsx
"use client";

import { useState } from "react";
import { Plus, X, ChevronUp, ChevronDown, Play } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { UnsTopicInput } from "./UnsTopicInput";
import { splitActions } from "@/hmi/symbols/action-buttons";
import { parsePayload } from "@/hmi/data/payload";
import type { MimicNode, DeviceAction, PublishMessage } from "@/hmi/schema/schema";

/** 行草稿：允许未填完（空 topic 行提交时过滤；动作 0 条有效消息则整条不落库）。 */
interface DraftAction { label: string; items: PublishMessage[]; confirm: boolean; more: boolean }

const toDraft = (a: DeviceAction): DraftAction => ({ label: a.label, items: [...a.items], confirm: a.confirm ?? false, more: false });
const NEW_DRAFT = (): DraftAction => ({ label: "启动", items: [{ topic: "", template: "{}" }], confirm: false, more: false });

export function ActionsEditor({
  node,
  onSetActions,
  onTestSend,
}: {
  node: MimicNode;
  onSetActions: (actions: DeviceAction[] | undefined) => void;
  /** 试发送：admin 调试，不走确认弹窗，逐条直发。 */
  onTestSend: (items: readonly PublishMessage[]) => void;
}) {
  const t = useT();
  const [drafts, setDrafts] = useState<DraftAction[]>(() => (node.actions ?? []).map(toDraft));

  const sanitize = (list: DraftAction[]): DeviceAction[] =>
    list
      .map((d) => ({
        label: d.label.trim(),
        items: d.items.filter((m) => m.topic.trim() !== "").map((m) => ({ topic: m.topic.trim(), template: m.template })),
        ...(d.confirm ? { confirm: true as const } : {}),
      }))
      .filter((a) => a.label !== "" && a.items.length > 0);

  /** 更新草稿；save=true 时提交 sanitize 结果（上层按现值幂等跳过）。 */
  const update = (next: DraftAction[], save: boolean) => {
    setDrafts(next);
    if (save) {
      const clean = sanitize(next);
      onSetActions(clean.length > 0 ? clean : undefined);
    }
  };
  const commit = () => update(drafts, true);

  const { direct } = splitActions(sanitize(drafts).length || drafts.length);

  if (drafts.length === 0) {
    return (
      <button
        type="button"
        onClick={() => update([NEW_DRAFT()], false)}
        data-testid="actions-empty-add"
        className="mb-4 flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border px-2 py-3 text-xs text-muted-foreground hover:bg-surface-inset hover:text-foreground"
      >
        <Plus className="size-3.5" />
        {t("给这台设备加一个操作按钮")}
      </button>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-2" data-testid="actions-editor" onBlur={commit}>
      {drafts.map((d, i) => (
        <div key={i} className="rounded-sm border border-border p-1.5" data-testid={`action-row-${i}`}>
          <div className="mb-1 flex items-center gap-1">
            <input
              value={d.label}
              onChange={(e) => update(drafts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)), false)}
              placeholder={t("按钮文字")}
              aria-label={t("按钮文字")}
              data-testid={`action-label-${i}`}
              className="h-6 min-w-0 flex-1 rounded-sm border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:border-focus-accent"
            />
            <span className="shrink-0 rounded-sm bg-surface-inset px-1 py-0.5 text-[9px] text-muted-foreground">
              {direct.includes(i) ? t("图上直达") : t("收进 ⋯ 菜单")}
            </span>
            <button type="button" onClick={() => onTestSend(sanitize([d])[0]?.items ?? [])} title={t("试发送（不弹确认，当场验证）")} aria-label={t("试发送")} data-testid={`action-test-${i}`} className="shrink-0 text-muted-foreground hover:text-foreground"><Play className="size-3" /></button>
            <button type="button" disabled={i === 0} onClick={() => { const n = [...drafts]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; update(n, true); }} aria-label={t("上移")} className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="size-3" /></button>
            <button type="button" disabled={i === drafts.length - 1} onClick={() => { const n = [...drafts]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; update(n, true); }} aria-label={t("下移")} className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="size-3" /></button>
            <button type="button" onClick={() => update(drafts.filter((_, j) => j !== i), true)} aria-label={t("删除该操作")} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
          </div>
          {/* 第一条消息默认展开（必填项就近）；其余收进「更多」 */}
          {(d.more ? d.items : d.items.slice(0, 1)).map((m, mi) => (
            <div key={mi} className="mb-1 rounded-sm border border-border p-1">
              <div className="mb-1 flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <UnsTopicInput
                    value={m.topic}
                    onChange={(v) => update(drafts.map((x, j) => (j === i ? { ...x, items: x.items.map((y, k) => (k === mi ? { ...y, topic: v } : y)) } : x)), false)}
                    onSelect={(v) => update(drafts.map((x, j) => (j === i ? { ...x, items: x.items.map((y, k) => (k === mi ? { ...y, topic: v } : y)) } : x)), true)}
                    placeholder={t("发到哪个主题 topic")}
                    testId={`action-${i}-topic-${mi}`}
                  />
                </div>
                {d.items.length > 1 ? (
                  <button type="button" onClick={() => update(drafts.map((x, j) => (j === i ? { ...x, items: x.items.filter((_, k) => k !== mi) } : x)), true)} aria-label={t("删除该条消息")} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
                ) : null}
              </div>
              <input
                value={m.template}
                onChange={(e) => update(drafts.map((x, j) => (j === i ? { ...x, items: x.items.map((y, k) => (k === mi ? { ...y, template: e.target.value } : y)) } : x)), false)}
                placeholder={t("发什么内容 payload")}
                aria-label={t("发什么内容 payload")}
                data-testid={`action-${i}-payload-${mi}`}
                className="w-full rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground outline-none focus:border-focus-accent"
              />
              {typeof parsePayload(m.template) === "string" && m.template.trim().startsWith("{") ? (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{t("不是合法 JSON，将按原文发送")}</p>
              ) : null}
            </div>
          ))}
          <button type="button" onClick={() => update(drafts.map((x, j) => (j === i ? { ...x, more: !x.more } : x)), false)} data-testid={`action-more-${i}`} className="text-[10px] text-muted-foreground hover:text-foreground">
            {d.more ? t("收起更多设置") : t("更多设置（多条消息 / 发送确认）")}
          </button>
          {d.more ? (
            <div className="mt-1 flex flex-col gap-1">
              <button type="button" onClick={() => update(drafts.map((x, j) => (j === i ? { ...x, items: [...x.items, { topic: "", template: "{}" }] } : x)), false)} className="flex w-full items-center justify-center gap-0.5 rounded-sm border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-surface-inset hover:text-foreground">
                <Plus className="size-3" />
                {t("添加消息")}
              </button>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <input type="checkbox" checked={d.confirm} onChange={(e) => update(drafts.map((x, j) => (j === i ? { ...x, confirm: e.target.checked } : x)), true)} data-testid={`action-confirm-${i}`} />
                {t("发送前弹窗确认")}
              </label>
            </div>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => update([...drafts, NEW_DRAFT()], false)} data-testid="actions-add" className="flex w-full items-center justify-center gap-0.5 rounded-sm border border-dashed border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-surface-inset hover:text-foreground">
        <Plus className="size-3" />
        {t("添加操作")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 删旧组件**——`git rm src/hmi/components/ControlEditor.tsx`
- [ ] **Step 3: 验证 + Commit**——`npx tsc --noEmit`（Inspector 引用错误留 Task 11）。`git add -A src/hmi/components && git commit -m "feat(hmi): ActionsEditor 动作列表编辑器（渐进披露/试发送/排序徽标）"`

### Task 10: ActionOverflowMenu 浮层

**Files:**
- Create: `src/hmi/components/ActionOverflowMenu.tsx`

- [ ] **Step 1: 写组件**：

```tsx
"use client";

import { useEffect } from "react";
import { useT } from "@/hmi/i18n/context";
import type { DeviceAction } from "@/hmi/schema/schema";

/**
 * ⋯ 溢出动作菜单（React 浮层，非 Canvas 绘制）：锚定按钮屏幕坐标，列出未直达的动作。
 * 点选执行；Esc / 点外部关闭；画布平移缩放由上层在 viewport 变化时卸载本组件。
 */
export function ActionOverflowMenu({
  actions,
  startIndex,
  anchorX,
  anchorY,
  onPick,
  onClose,
}: {
  /** 溢出部分动作（原列表 slice(startIndex)）。 */
  actions: readonly DeviceAction[];
  /** 溢出首项在完整动作列表中的下标（回传执行用）。 */
  startIndex: number;
  anchorX: number;
  anchorY: number;
  onPick: (actionIndex: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40" onClick={onClose} data-testid="action-overflow-overlay">
      <div
        role="menu"
        aria-label={t("更多操作")}
        className="absolute z-50 min-w-28 rounded-md border border-border bg-card py-1 shadow-lg"
        style={{ left: anchorX, top: anchorY }}
        onClick={(e) => e.stopPropagation()}
        data-testid="action-overflow-menu"
      >
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => onPick(startIndex + i)}
            title={a.label}
            data-testid={`overflow-item-${i}`}
            className="block w-full truncate px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-inset"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证 + Commit**——`npx tsc --noEmit`；`git add src/hmi/components/ActionOverflowMenu.tsx && git commit -m "feat(hmi): 溢出动作浮层菜单"`

### Task 11: HmiPage + Inspector 接线（执行链路 / 移除 PublishPanel 与 AlarmStrip）

**Files:**
- Modify: `src/hmi/components/HmiPage.tsx`、`src/hmi/components/Inspector.tsx`
- Delete: `src/hmi/components/PublishPanel.tsx`、`src/hmi/components/AlarmStrip.tsx`、`src/hmi/scene/alarms.ts`、`src/hmi/scene/alarms.test.ts`

- [ ] **Step 1: Inspector.tsx**：
  - 删 `PublishPanel` import 与 `<PublishPanel …/>` JSX；props 删 `onPublish`/`onSavePreset`/`onRemovePreset`（注意：`onPublish` 改名为 `onTestSend: (items: readonly PublishMessage[]) => void` 供 ActionsEditor）
  - 删 `ControlEditor` import；「操作」分节改为**对所有设备显示**（按钮挂任何设备，不再限品类）：

```tsx
        {!readOnly ? (
          <>
            {/* 操作（写值动作）与数据绑定（数据→外观）严格分节 */}
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("操作")}</p>
            <ActionsEditor node={node} onSetActions={onSetActions} onTestSend={onTestSend} />
          </>
        ) : null}
```

  - props：`onSetControl` 替换为 `onSetActions: (actions: DeviceAction[] | undefined) => void`；import 类型同步
- [ ] **Step 2: HmiPage.tsx 改造**（在 B-P0 接线基础上替换）：
  - import：删 `resolveControlClick`/`renderWritePayload`/`ControlInvocation`/`setNodeControl`/`collectAlarms`/`AlarmStrip`；增 `parsePayload`（from `@/hmi/data/payload`）、`setNodeActions`、`ActionOverflowMenu`、`splitActions`（from `@/hmi/symbols/action-buttons`）、类型 `DeviceAction`
  - 删 `const alarms = collectAlarms(scene, getState);` 与 `<AlarmStrip …/>` JSX 及底部相关布局
  - `getState` 内 `!node.control` 改为 `!node.actions?.length`
  - 执行链路（替换原 controlDialog/handleCanvasSelect/confirmControlDialog 整段）：

```tsx
  // ── 设备动作按钮：预览点击=执行（确认可选+按钮原位反馈），编辑点击按钮=选中配置 ──
  const [confirmReq, setConfirmReq] = useState<{ node: MimicNode; actionIndex: number } | null>(null);
  const [overflowMenu, setOverflowMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  // sent 反馈：key=`${nodeId}:${index}`，1.5s 自动清除；进 redrawKey 驱动画布重绘
  const [sentKeys, setSentKeys] = useState<ReadonlySet<string>>(new Set());
  const sentTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => { for (const t of sentTimers.current.values()) clearTimeout(t); }, []);
  const flashSent = (key: string) => {
    setSentKeys((s) => new Set(s).add(key));
    const old = sentTimers.current.get(key);
    if (old) clearTimeout(old);
    sentTimers.current.set(key, setTimeout(() => {
      setSentKeys((s) => { const n = new Set(s); n.delete(key); return n; });
    }, 1500));
  };
  const sendItems = (items: readonly PublishMessage[]) => {
    for (const item of items) {
      const payload = parsePayload(item.template);
      sourceRef.current?.publish(item.topic, payload);
      tagStore.setMessage(item.topic, payload); // 乐观回显：下发值即时上屏，设备真实数据到达会覆盖
    }
  };
  const executeAction = (nodeId: string, actionIndex: number) => {
    const node = scene.byId[nodeId];
    const action = node?.actions?.[actionIndex];
    if (!node || !action) return;
    if (action.confirm) { setConfirmReq({ node, actionIndex }); return; }
    sendItems(action.items);
    flashSent(`${nodeId}:${actionIndex}`);
  };
  const openOverflow = (nodeId: string, x: number, y: number) => setOverflowMenu({ nodeId, x, y });
```

  - HmiCanvas 接线（props 追加/替换）：

```tsx
            onSelect={selectOne}
            onActionClick={!editing ? executeAction : undefined}
            onActionOverflow={!editing ? openOverflow : undefined}
            getActionFeedback={(nodeId, i) => sentKeys.has(`${nodeId}:${i}`)}
```

  （编辑模式命中按钮 HmiCanvas 内部已走 `onSelect`，无需额外分支；原 `handleCanvasSelect` 删除，恢复直接 `selectOne`）
  - `redrawKey` 改为：`` `${selectedIds.join(",")}|${lang}|${[...sentKeys].join(",")}` ``
  - JSX 尾部（原 ControlDialog 渲染处替换）：

```tsx
      {confirmReq ? (
        <ControlDialog
          request={{
            kind: "confirm",
            title: confirmReq.node.label ?? confirmReq.node.id,
            message: t("将发送 {n} 条消息，确认执行？", { n: confirmReq.node.actions![confirmReq.actionIndex].items.length }),
            confirmLabel: confirmReq.node.actions![confirmReq.actionIndex].label,
          }}
          onConfirm={() => {
            const r = confirmReq;
            setConfirmReq(null);
            sendItems(r.node.actions![r.actionIndex].items);
            flashSent(`${r.node.id}:${r.actionIndex}`);
          }}
          onCancel={() => setConfirmReq(null)}
        />
      ) : null}
      {overflowMenu ? (() => {
        const n = scene.byId[overflowMenu.nodeId];
        const all = n?.actions ?? [];
        const { overflow } = splitActions(all.length);
        return overflow.length > 0 ? (
          <ActionOverflowMenu
            actions={overflow.map((i) => all[i])}
            startIndex={overflow[0]}
            anchorX={overflowMenu.x}
            anchorY={overflowMenu.y}
            onPick={(i) => { setOverflowMenu(null); executeAction(overflowMenu.nodeId, i); }}
            onClose={() => setOverflowMenu(null)}
          />
        ) : null;
      })() : null}
```

  - Inspector 接线：删 `onPublish`/`onSavePreset`/`onRemovePreset`/`onSetControl`，增：

```tsx
              onTestSend={(items) => { sendItems(items); }}
              onSetActions={(actions) =>
                history.commit((s) => {
                  const cur = s.nodes.find((n) => n.id === selectedNode.id)?.actions;
                  if (JSON.stringify(cur ?? null) === JSON.stringify(actions ?? null)) return s; // 幂等防 undo 刷屏
                  return setNodeActions(s, selectedNode.id, actions);
                })
              }
```

  - 旧顶部 toast（controlToast）整段删除（反馈改按钮原位）
- [ ] **Step 3: 删文件**——`git rm src/hmi/components/PublishPanel.tsx src/hmi/components/AlarmStrip.tsx src/hmi/scene/alarms.ts src/hmi/scene/alarms.test.ts`
- [ ] **Step 4: 全量验证**——`npx tsc --noEmit` 必须 0 错；`npm test` 全绿
- [ ] **Step 5: Commit**——`git commit -am "feat(hmi): 设备动作按钮执行链路接线；移除 PublishPanel 与底部告警条"`

### Task 12: i18n 词条增删

**Files:**
- Modify: `src/hmi/i18n/dict.ts`

- [ ] **Step 1: 删除**——B-P0 词条（「按钮 Button」「控制开关 Toggle」「设定值 Setpoint」三 cap 及其 desc/states/effect 词条、「输入设定值」「数值需在 {range} 之间」「请输入有效数字」「切到开/关」「点按动作…」「写值…」等控制元件配置节）与 PublishPanel 专属词条（「MQTT 发布」「发送全部 ({n} 条)」「模板…」系列、AlarmStrip 的「无活动报警」「{n} 故障」「{n} 失联」）。判定标准：`grep -rn "词条键" src/ --include="*.tsx" --include="*.ts" | grep -v dict.ts` 无引用即删
- [ ] **Step 2: 新增**（zh-as-key）：

```ts
  // ── 设备动作按钮 ──
  "给这台设备加一个操作按钮": "Add an action button to this device",
  "添加操作": "Add action",
  "按钮文字": "Button label",
  "图上直达": "On canvas",
  "收进 ⋯ 菜单": "In ⋯ menu",
  "试发送": "Test send",
  "试发送（不弹确认，当场验证）": "Test send (no confirm dialog)",
  "上移": "Move up",
  "下移": "Move down",
  "删除该操作": "Remove this action",
  "发到哪个主题 topic": "Topic to publish to",
  "发什么内容 payload": "Payload to send",
  "不是合法 JSON，将按原文发送": "Not valid JSON — will be sent as raw text",
  "更多设置（多条消息 / 发送确认）": "More (multiple messages / confirm)",
  "收起更多设置": "Hide more",
  "更多操作": "More actions",
```

  保留仍被引用的：「操作」「发送前弹窗确认」「将发送 {n} 条消息，确认执行？」「取消」「添加消息」「删除该条消息」
- [ ] **Step 3: 验证 + Commit**——`npm test` 全绿 + `npx eslint src/hmi/i18n/dict.ts`；`git commit -am "chore(hmi): i18n 词条随设备动作按钮增删"`

### Task 13: E2E 重写与全量验证

**Files:**
- Modify: `e2e/hmi.spec.ts`

- [ ] **Step 1: 用例 1**——删除 `await expect(page.getByTestId("alarm-strip")).toBeVisible();` 一行
- [ ] **Step 2: 删除旧用例**——「MQTT 发布面板：选设备、改 payload、发送（mock）」与「控制元件：放置按钮、配置动作、预览点击发送（toast），删除恢复」两个 test 整体删除
- [ ] **Step 3: 新用例**：

```ts
  test("设备动作按钮：配动作、画布出按钮、预览点击发送、删除恢复", async ({ page }) => {
    await page.goto("/");
    const canvas = page.getByTestId("hmi-canvas");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("conn-status")).toContainText(/已连接|连接错误/, { timeout: 10_000 });

    // 放一个新设备到画布中心（自动选中开 Inspector），给它配动作
    await page.getByTestId("palette-toggle").click();
    await page.getByTestId("palette-item-pump").click();
    await expect(page.getByTestId("inspector")).toBeVisible();
    await page.getByTestId("actions-empty-add").click();
    await page.getByTestId("action-0-topic-0").fill("e2e/cmd/btn");
    await page.getByTestId("action-0-payload-0").fill('{"run":1}');
    await page.getByTestId("inspector-title").click(); // 失焦提交

    // 关元件库与 Inspector，画布回满宽；按钮停靠在设备下方（中心下 ~55px）
    await page.getByRole("button", { name: "收起元件库" }).click();
    await page.getByRole("button", { name: "关闭" }).click();
    await page.getByRole("button", { name: "预览" }).click();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("no canvas box");
    // 点按钮（容错扫描几个纵向偏移）；命中后按钮进入 sent 态，Inspector 不应打开
    for (const dy of [55, 48, 62, 70]) {
      await canvas.click({ position: { x: box.width / 2, y: box.height / 2 + dy } });
      if (!(await page.getByTestId("inspector").isVisible())) break;
      await page.getByRole("button", { name: "关闭" }).click(); // 误中设备则关掉重试
    }
    await expect(page.getByTestId("inspector")).toBeHidden();

    // 清理：回编辑删除测试设备，等自动保存
    await page.getByRole("button", { name: "编辑" }).click();
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.getByTestId("inspector")).toBeVisible();
    await page.getByTestId("inspector-delete").click();
    await page.waitForTimeout(1200);
  });
```

- [ ] **Step 4: 全量验证**——`npx tsc --noEmit` + `npm test` + `npm run e2e`，三者全绿；eslint 跑全部改动文件 0 错
- [ ] **Step 5: Commit**——`git add e2e/ && git commit -m "test(e2e): 设备动作按钮链路用例，移除发布面板/告警条断言"`

### Task 14: 浏览器实测 + 设计文档同步

**Files:**
- Modify: `docs/hmi-design-spec.md`

- [ ] **Step 1: 浏览器实测**（dev:preview，Chrome 工具）——验收清单：① 给真实设备（如 P-101）配「启动/停止」两动作 → 画布设备下方实时出现两个胶囊；② 配 5 个动作 → 变为 2 + ⋯，点 ⋯ 弹菜单可执行；③ 预览点按钮 → 原位「✓」绿反馈；勾确认的动作弹确认窗；④ 试发送即时生效；⑤ operator 视角（预览）无任何配置入口；⑥ 底部无告警条。截图留存。**实测完撤销全部试验编辑（undo 到底或删测试动作），恢复画布原状**
- [ ] **Step 2: 设计文档同步**——`docs/hmi-design-spec.md`：§4.1 表删 AlarmStrip 行；§4.3 删 PublishPanel 行、增 `ActionsEditor` 行（职责：设备动作列表编辑，试发送/排序/渐进披露）；§5.3 整节重写为「设备动作按钮」（按本计划 TL;DR 描述）；§5.4 报警链路删 AlarmStrip 环节（终点改为画布装饰）；§7.3 追加一行：「2026-06-11 形态演进：独立控制图元 → 设备附属动作按钮（见 specs/2026-06-11 设计）」
- [ ] **Step 3: Commit**——`git add docs/ && git commit -m "docs: 设计文档同步设备动作按钮形态与告警条移除"`

---

## 自审记录

- spec 覆盖：§2.2 数据模型→Task 1/2；§2.3 渲染溢出→Task 5/6；§2.4 交互权限→Task 7/11；§2.5 配置面板→Task 9；§2.6 引擎→Task 5/6/7/10；§1 易用性六手段→Task 9（实时预览=commit 即重渲、渐进披露=更多设置、默认值=NEW_DRAFT、零术语=文案、空状态=empty-add、试一发=onTestSend）；§3.3 告警条→Task 11/13/14；publishPresets 保留解析→schema 未动该字段 ✓
- 类型一致性：`DeviceAction`/`setNodeActions`/`ActionButtonBox`/`ActionVisual`/`onTestSend` 全计划统一 ✓
- 占位符：Task 6 Step 1 测试体要求执行者按文件既有 helper 补全（构造模式文件内自明），其余无占位 ✓
