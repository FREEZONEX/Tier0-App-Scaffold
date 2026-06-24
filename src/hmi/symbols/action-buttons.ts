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
/**
 * 行起点距 bounds 底边的额外间距（在标签/内联占位之后）。
 * 各 symbol 的标签/内联基线实际落在 bounds 底 +14~18（文字底≈+36），
 * 取 12（按钮顶=底+42）：归属容器框 + 连接线在按钮上方绘制后，与文字底仍留余量。
 */
const ROW_GAP = 12;
/**
 * 归属容器：圆角矩形描边把该设备的全部动作按钮框起来（结构色细描边 + 极浅半透明衬底），
 * 表达「这排按钮属于上方设备」。padding=按钮行四周留白；半径略大于按钮胶囊。
 */
const CONTAINER_PAD = 4;
const CONTAINER_R = 12;
const CONTAINER_STROKE_W = 1;
/** 极浅衬底透明度：让框内区域与画布微弱区分，又不抢异常色。 */
const CONTAINER_FILL_OPACITY = 0.5;
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

/**
 * 估算文字宽：CJK（部首补充/统一表意 U+2E80–9FFF、兼容表意 U+F900–FAFF、全角形 U+FF00–FFEF）
 * ~10px/字、其余 ~6px/字（10px 字号；布局期拿不到 ctx.measureText）。
 */
export function estimateTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/u.test(ch) ? 10 : 6;
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

/**
 * 归属装饰（仅容器框）：把该设备的全部动作按钮框进一个结构色细描边圆角矩形。
 * 早前还有「框顶短线 + 指向设备的小三角箭头」，用户反馈不好看已移除——
 * 按钮停靠在设备正下方，归属关系靠位置已足够明确。无按钮时返回空。
 */
function buildTether(boxes: readonly ActionButtonBox[], theme: Palette): Primitive[] {
  if (boxes.length === 0) return [];
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  const left = first.x - CONTAINER_PAD;
  const right = last.x + last.w + CONTAINER_PAD;
  const top = first.y - CONTAINER_PAD;
  const bottom = first.y + first.h + CONTAINER_PAD;
  return [
    // 容器框：极浅半透明衬底 + 结构色细描边（textMuted），克制不抢异常色。
    {
      kind: "rect",
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
      r: CONTAINER_R,
      style: { fill: theme.fillLight, opacity: CONTAINER_FILL_OPACITY, stroke: theme.textMuted, strokeWidth: CONTAINER_STROKE_W },
    },
  ];
}

/**
 * 胶囊绘制：idle=浅底描边；pressed=深底；sent=运行绿底白字「✓」由调用方换 text。
 * 先画归属容器框 + 连接线（在按钮之下，不遮按钮文字），再叠胶囊行。
 */
export function buildActionButtons(
  boxes: readonly ActionButtonBox[],
  theme: Palette,
  visualOf: (box: ActionButtonBox) => ActionVisual,
): Primitive[] {
  const out: Primitive[] = [...buildTether(boxes, theme)];
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
