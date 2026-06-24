import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { fillPct } from "./fill";
import { showDetail } from "./lod";

const W = 18;
const H = 64;
const TICK_LEN = 4; // 右侧刻度短线长度（细节层）
const TICK_GAP = 2; // 刻度线与外框右沿间距
const SEAM_W = 1; // 细线宽

/** 条形仪表：竖条按 value(0-100) 从底部填充；细节层加右侧 4 道刻度短线。 */
export const bargauge: SymbolDef = {
  type: "bargauge",
  inlineFields: ["value"],
  bounds: (node) => ({ x: node.x - W / 2, y: node.y - H / 2, w: W, h: H }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const left = node.x - W / 2;
    const top = node.y - H / 2;
    const right = left + W;
    const bottom = top + H;
    const value = fillPct(state, "value");
    const fillH = (H * value) / 100;
    const detail = showDetail(scale);
    const out: Primitive[] = [
      // 外边框矩形（基础形体）
      { kind: "rect", x: left, y: top, w: W, h: H, r: 2, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    // 液位条（状态层，任何缩放都画）：裁剪到外框圆角内，从底部向上填充
    if (fillH > 0) {
      out.push({
        kind: "clip",
        x: left,
        y: top,
        w: W,
        h: H,
        r: 2,
        children: [{ kind: "rect", x: left, y: bottom - fillH, w: W, h: fillH, style: { fill: theme.liquid } }],
      });
    }
    if (detail) {
      // 细节层：右侧 4 道刻度短线（25/50/75/100% 等分，低对比 textMuted）
      const tx = right + TICK_GAP;
      for (let i = 1; i <= 4; i++) {
        const ty = bottom - (H * i) / 4;
        out.push({ kind: "line", x1: tx, y1: ty, x2: tx + TICK_LEN, y2: ty, style: { stroke: theme.textMuted, strokeWidth: SEAM_W } });
      }
    }
    out.push(...labelAndInline(node, state, theme, bottom + 16));
    return out;
  },
};
