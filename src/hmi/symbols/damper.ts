import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { toBool } from "../shared/coerce";
import { showDetail } from "./lod";

const W = 40; // 风道宽
const H = 32; // 风道高
const BLADES = 3; // 百叶叶片数（基础形体始终绘制）
const ACT_W = 12; // 执行机构小盒宽
const ACT_H = 9; // 执行机构小盒高
const ACT_GAP = 6; // 小盒离风道顶边的间距（细节层连杆跨此间距）

const isOpen = (values: Readonly<Record<string, unknown>>): boolean => toBool(values.open ?? values.running);

/**
 * 风门：风道矩形 + 斜线百叶（多叶片）。开=顺流横置（低阻），关=斜置阻断。
 * 外挂执行机构小盒（顶部侧面小矩形）+ 连杆（细节层，盒到叶片轴的短线）。
 * 状态：开（激活）= fillDeep 实心叶片，关（静止）= fillLight；异常色由上层装饰层负责。
 */
export const damper: SymbolDef = {
  type: "damper",
  inlineFields: ["open"],
  // 命中框：上覆执行机构小盒，下覆位号/内联两行文本。锚点 node.x/y 视觉居中于风道。
  bounds: (node) => ({
    x: node.x - W / 2,
    y: node.y - H / 2 - (ACT_H + ACT_GAP),
    w: W,
    h: H + (ACT_H + ACT_GAP) + 16 + 14,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const left = node.x - W / 2;
    const top = node.y - H / 2;
    const right = left + W;
    const bottom = top + H;
    const cx = node.x;
    const cy = node.y;
    const open = isOpen(state.values);
    const detail = showDetail(scale);
    // 激活（开）= 叶片实心 fillDeep，静止（关）= fillLight。绝不让细节抢异常色。
    const bladeStroke = open ? theme.running : theme.stroke;

    const out: Primitive[] = [
      // 风道矩形（基础形体）
      { kind: "rect", x: left, y: top, w: W, h: H, r: 2, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];

    // 斜线百叶：开=水平（y1==y2，顺流低阻），关=斜置（y1!=y2，阻断）。基础形体，任何缩放都画。
    const inset = 6;
    const slotTop = top + 6;
    const slotBottom = bottom - 6;
    const step = (slotBottom - slotTop) / (BLADES - 1);
    const tilt = 6; // 关态叶片的斜度（半高），open 时为 0
    for (let i = 0; i < BLADES; i++) {
      const by = slotTop + step * i;
      if (open) {
        out.push({ kind: "line", x1: left + inset, y1: by, x2: right - inset, y2: by, style: { stroke: bladeStroke, strokeWidth: 2.5, lineCap: "round" } });
      } else {
        out.push({ kind: "line", x1: left + inset, y1: by - tilt, x2: right - inset, y2: by + tilt, style: { stroke: bladeStroke, strokeWidth: 2.5, lineCap: "round" } });
      }
    }

    // 外挂执行机构小盒（顶部中心，侧面小矩形）。基础形体——风门辨识特征。
    const actLeft = cx - ACT_W / 2;
    const actTop = top - ACT_GAP - ACT_H;
    out.push({ kind: "rect", x: actLeft, y: actTop, w: ACT_W, h: ACT_H, r: 1, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } });

    if (detail) {
      // 细节层：连杆（执行机构盒底 → 叶片轴中心的短线）+ 盒内轴线小细节，低对比 textMuted。
      out.push(
        { kind: "line", x1: cx, y1: actTop + ACT_H, x2: cx, y2: cy, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: actLeft + 2, y1: actTop + ACT_H / 2, x2: actLeft + ACT_W - 2, y2: actTop + ACT_H / 2, style: { stroke: theme.textMuted, strokeWidth: 1 } },
      );
    }

    out.push(...labelAndInline(node, state, theme, bottom + 16));
    return out;
  },
};
