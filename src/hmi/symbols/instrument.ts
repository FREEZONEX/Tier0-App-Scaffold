import type { SymbolDef, SymbolContext } from "./registry";
import type { MimicNode } from "../schema/schema";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { formatInlineValue } from "./inline";

const R = 18;
// ISA-5.1 线宽规范：外圈描边 OUTLINE_W。
const OUTLINE_W = 2;

// box（DCS 数据框）显示模式尺寸：顶部位号带 + 下方数值，整体两行框
const BOX_H = 36;
const BOX_HEADER_H = 15;
const BOX_CHAR_W = 6.2;
const BOX_PAD = 14;
const BOX_MIN_W = 60;

/** 默认 DCS 数据框；显式 display==="bubble" 才回圆气泡。 */
function isBox(node: MimicNode): boolean {
  return node.props?.display !== "bubble";
}
/** 框宽按位号（node.id）长度估算——bounds 无 state 拿不到值长度，故以位号定宽，build/bounds 一致避免环/命中错位。 */
function boxWidth(node: MimicNode): number {
  return Math.max(BOX_MIN_W, node.id.length * BOX_CHAR_W + BOX_PAD);
}

/** node.props.tag → 圆心位号；缺省回落 props.face 单字母，再回落 "I"。 */
function resolveTag(props: Record<string, unknown> | undefined): string {
  const tag = props?.tag;
  if (typeof tag === "string" && tag.trim() !== "") return tag.trim();
  const face = props?.face;
  if (typeof face === "string" && face.trim() !== "") return face.trim();
  return "I";
}

/** ISA-101 仪表气泡：ISA-5.1 标准圆 + 圆心位号文字（FT/LT/PT…）。 */
function buildBubble({ node, state, theme }: SymbolContext): Primitive[] {
  const cx = node.x;
  const cy = node.y;
  const tag = resolveTag(node.props);
  const out: Primitive[] = [
    // 基础形体：ISA 圆（外圈 strokeWidth:2、theme.stroke、fillLight）——任何缩放都画
    { kind: "circle", cx, cy, r: R, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: OUTLINE_W } },
    { kind: "text", x: cx, y: cy + 4, text: tag, style: { fill: theme.text, font: "700 11px ui-sans-serif, system-ui", textAlign: "center" } },
  ];
  out.push(...labelAndInline(node, state, theme, cy + R + 16));
  return out;
}

/**
 * DCS 数据框：顶部深色带显**完整位号**（node.id，如 PI-035A）、下方浅底显实时值（越限变色），中文名留框下方。
 * 还原 SUPCON 等 DCS 画面常见的「位号+数值」方框风格；位号简写撞车（满屏 LIC/FIC）时靠完整位号区分。
 * 非圆形（circular 函数返回 false）→ 连线/背板/命中/装饰环都按方框走（剪影背板自动贴边收口）。
 */
function buildBox({ node, state, theme }: SymbolContext): Primitive[] {
  const cx = node.x;
  const cy = node.y;
  const w = boxWidth(node);
  const left = cx - w / 2;
  const top = cy - BOX_H / 2;
  const bottom = top + BOX_H;
  const value = formatInlineValue("value", state.values.value, state.units?.value);
  const level = state.levels?.value ?? state.alarm;
  const valColor = level === "alarm" ? theme.alarm : level === "warn" ? theme.interlock : theme.text;
  return [
    // 框体（裁到圆角内）：浅底 + 顶部深色位号带
    {
      kind: "clip",
      x: left,
      y: top,
      w,
      h: BOX_H,
      r: 3,
      children: [
        { kind: "rect", x: left, y: top, w, h: BOX_H, style: { fill: theme.fillLight } },
        { kind: "rect", x: left, y: top, w, h: BOX_HEADER_H, style: { fill: theme.fillDeep } },
      ],
    },
    // 外框描边（无填充，画在带子之上保住边框）
    { kind: "rect", x: left, y: top, w, h: BOX_H, r: 3, style: { stroke: theme.stroke, strokeWidth: 1.5 } },
    // 位号（带上浅色文字）
    { kind: "text", x: cx, y: top + BOX_HEADER_H - 4, text: node.id, style: { fill: theme.fillLight, font: "600 9px ui-sans-serif, system-ui", textAlign: "center" } },
    // 实时值（越限变色）
    { kind: "text", x: cx, y: top + BOX_HEADER_H + (BOX_H - BOX_HEADER_H) / 2 + 4, text: value, style: { fill: valColor, font: "600 13px ui-sans-serif, system-ui", textAlign: "center" } },
    // 中文名（框下方，与圆气泡的标签排版一致）
    ...(node.label
      ? [{ kind: "text", x: cx, y: bottom + 12, text: node.label, style: { fill: theme.textMuted, font: "10px ui-sans-serif, system-ui", textAlign: "center", halo: theme.canvas } } as Primitive]
      : []),
  ];
}

/**
 * ISA-101 仪表：默认 DCS 数据框（位号 + 数值）；`props.display==="bubble"` 切回 ISA 圆气泡。
 * circular 按 node 逐个判定——box 模式非圆形，连线/背板/命中/装饰环都随之走方框。
 * fault 不在此处特殊处理（渲染器统一加红环）。
 */
export const instrument: SymbolDef = {
  type: "instrument",
  inlineFields: ["value"],
  circular: (node) => !isBox(node),
  bounds: (node) => {
    if (isBox(node)) {
      const w = boxWidth(node);
      return { x: node.x - w / 2 - 2, y: node.y - BOX_H / 2 - 2, w: w + 4, h: BOX_H + 4 };
    }
    return { x: node.x - R - 2, y: node.y - R - 2, w: (R + 2) * 2, h: (R + 2) * 2 };
  },
  build: (ctx) => (isBox(ctx.node) ? buildBox(ctx) : buildBubble(ctx)),
};
