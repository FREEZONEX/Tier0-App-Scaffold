import type { MimicNode } from "../schema/schema";
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";

/** 直达/溢出规则：≤3 全直达；≥4 前 MAX_DIRECT 个直达、其余进 ⋯ 菜单（溢出只剩 1 个不值得占 ⋯ 位）。 */
const MAX_DIRECT = 2;
const MAX_NO_OVERFLOW = 3;
/** 以下像素常量均为 scale=1（节点默认大小）时的基准值；用前一律 ×scale 跟节点等比缩放。 */
const BTN_H = 18;
const BTN_R = 9;
const GAP = 4;
const PAD_X = 8;
const MAX_CHARS = 6;
const FONT_PX = 10;
/** 内容底（图形/文字）到归属容器框顶边的净距。按钮 y 会再加 CONTAINER_PAD——净距按框边算而非按钮顶，否则框把间距吃掉、按钮贴脸内容。 */
const ROW_GAP = 6;
/** 文字图元 y 是基线；视觉底 ≈ 基线 + 字体下伸（10~11px 字号 ≈ 3px）。 */
const TEXT_DESCENT = 3;
/**
 * 归属容器：圆角矩形描边把该设备的全部动作按钮框起来（结构色细描边 + 极浅半透明衬底），
 * 表达「这排按钮属于上方设备」。padding=按钮行四周留白；半径略大于按钮胶囊。
 */
const CONTAINER_PAD = 4;
const CONTAINER_R = 12;
const CONTAINER_STROKE_W = 1;
/** 极浅衬底透明度：让框内区域与画布微弱区分，又不抢异常色。 */
const CONTAINER_FILL_OPACITY = 0.5;

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
 * 内容底：图形底（refBottom）与其**下方**全部文字图元视觉底的最大值（递归进 clip/rotate/scale 组）。
 * 按钮锚这里而非「常量估算文字占位」——各 symbol 的位号/内联 belowY 是手调值（图形底 +12~16 不等），
 * 常量假设导致按钮与内容的间距忽近忽远（agitator 远、motor 近的真实反馈）。高于 refBottom 的文字
 * （tank 拱顶位号/罐内液位值）天然不参与，无需 noBelowText 之类的旗子。
 */
export function contentBottomOf(prims: readonly Primitive[], refBottom: number): number {
  let bottom = refBottom;
  for (const p of prims) {
    if (p.kind === "text" && p.y > refBottom) bottom = Math.max(bottom, p.y + TEXT_DESCENT);
    else if ("children" in p) bottom = Math.max(bottom, contentBottomOf(p.children, refBottom));
  }
  return bottom;
}

/**
 * 停靠布局：按钮行水平居中于 node.x，纵向在 anchorY（内容底：图形或下方文字最低点的世界 y，
 * 调用方经 contentBottomOf 算出）之下 (ROW_GAP+CONTAINER_PAD)×scale——归属容器框比按钮顶
 * 高出 CONTAINER_PAD，这样**框顶边到内容的净距恒为 ROW_GAP**，所有 symbol 一致。
 * 返回世界坐标盒（含 ⋯）。无动作返回空数组。
 *
 * scale：节点缩放系数（默认 1，等比拉伸时 = sizeY）——按钮尺寸（高/宽/间距/偏移）随设备等比
 * 缩放，否则设备拉得越大固定尺寸的按钮相对越显得小，比例失衡。
 */
export function layoutActionButtons(node: MimicNode, anchorY: number, scale = 1): ActionButtonBox[] {
  const actions = node.actions ?? [];
  if (actions.length === 0) return [];
  const { direct, overflow } = splitActions(actions.length);
  const entries = [
    ...direct.map((i) => ({ action: i as number | "overflow", text: truncateLabel(actions[i].label) })),
    ...(overflow.length > 0 ? [{ action: "overflow" as const, text: "⋯" }] : []),
  ];
  const btnH = BTN_H * scale;
  const padX = PAD_X * scale;
  const gap = GAP * scale;
  const widths = entries.map((e) => Math.max(btnH, estimateTextWidth(e.text) * scale + padX * 2));
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (entries.length - 1);
  const y = anchorY + (ROW_GAP + CONTAINER_PAD) * scale;
  let x = node.x - totalW / 2;
  return entries.map((e, i) => {
    const box: ActionButtonBox = { nodeId: node.id, action: e.action, x, y, w: widths[i], h: btnH, text: e.text };
    x += widths[i] + gap;
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
function buildTether(boxes: readonly ActionButtonBox[], theme: Palette, scale: number): Primitive[] {
  if (boxes.length === 0) return [];
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  const pad = CONTAINER_PAD * scale;
  const left = first.x - pad;
  const right = last.x + last.w + pad;
  const top = first.y - pad;
  const bottom = first.y + first.h + pad;
  return [
    // 容器框：极浅半透明衬底 + 结构色细描边（textMuted），克制不抢异常色。
    {
      kind: "rect",
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
      r: CONTAINER_R * scale,
      style: { fill: theme.fillLight, opacity: CONTAINER_FILL_OPACITY, stroke: theme.textMuted, strokeWidth: CONTAINER_STROKE_W * scale },
    },
  ];
}

/**
 * 胶囊绘制：idle=浅底描边；pressed=深底；sent=运行绿底白字「✓」由调用方换 text。
 * 先画归属容器框 + 连接线（在按钮之下，不遮按钮文字），再叠胶囊行。
 * scale：节点缩放系数（默认 1）——圆角/描边/字号/文字基线偏移全部跟按钮尺寸同步缩放，
 * 否则大按钮配细描边、小按钮配粗描边，观感失调。
 */
export function buildActionButtons(
  boxes: readonly ActionButtonBox[],
  theme: Palette,
  visualOf: (box: ActionButtonBox) => ActionVisual,
  scale = 1,
): Primitive[] {
  const out: Primitive[] = [...buildTether(boxes, theme, scale)];
  const font = `${FONT_PX * scale}px ui-sans-serif, system-ui`;
  for (const b of boxes) {
    const visual = visualOf(b);
    const fill = visual === "sent" ? theme.running : visual === "pressed" ? theme.fillDeep : theme.fillLight;
    const textFill = visual === "idle" ? theme.text : theme.badgeFg;
    out.push(
      { kind: "rect", x: b.x, y: b.y, w: b.w, h: b.h, r: BTN_R * scale, style: { fill, stroke: theme.stroke, strokeWidth: 1.25 * scale } },
      { kind: "text", x: b.x + b.w / 2, y: b.y + b.h / 2 + 3.5 * scale, text: visual === "sent" ? "✓" : b.text, style: { fill: textFill, font, textAlign: "center" } },
    );
  }
  return out;
}
