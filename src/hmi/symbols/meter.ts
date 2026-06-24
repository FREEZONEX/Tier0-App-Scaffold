import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

const R = 18; // 表体外接半径（命中按外接圆，circular 保 true）
const PIPE = 6; // 两侧管段接头外伸长度
const FLANGE_X = 4; // 法兰对相对管段端点的内移量（细节层）
const FLANGE_H = 5; // 法兰竖短线半高
const WIN_W = 16; // 表面读数窗宽
const WIN_H = 8; // 表面读数窗高

/**
 * 流量计：表体圆 + 表面读数窗（圆内小矩形）+ 两侧管段接头与法兰对（细节层）。
 * 状态层：running→表体 fillDeep、静止→fillLight（与全库一致，绝不让细节抢异常色）。
 * 流向双 chevron 与内联读数走 labelAndInline 保留现有读数/状态逻辑。
 */
export const meter: SymbolDef = {
  type: "meter",
  inlineFields: ["flow"],
  circular: true,
  // 命中框含两侧管段+法兰对的外伸；锚点 node.x/y 视觉居中于表体圆。
  bounds: (node) => ({ x: node.x - R - PIPE - 2, y: node.y - R - 2, w: (R + PIPE + 2) * 2, h: (R + 2) * 2 }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const fill = state.running ? theme.running : theme.fillLight;
    const detail = showDetail(scale);
    const out: Primitive[] = [
      // 两侧管段接头（基础形体：流量计辨识特征，结构件不随状态变色）
      { kind: "line", x1: cx - R - PIPE, y1: cy, x2: cx - R, y2: cy, style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
      { kind: "line", x1: cx + R, y1: cy, x2: cx + R + PIPE, y2: cy, style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
      // 表体圆（状态层：running→fillDeep / 静止→fillLight）
      { kind: "circle", cx, cy, r: R, style: { fill, stroke: theme.stroke, strokeWidth: 2 } },
      // 表面读数窗（基础形体：圆内小矩形窗，恒以 fillLight 读作窗口，不抢状态色）
      { kind: "rect", x: cx - WIN_W / 2, y: cy - WIN_H / 2, w: WIN_W, h: WIN_H, r: 1.5, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 1.25 } },
      // 流向双 chevron（读数/状态视觉，保留现有逻辑）
      { kind: "polyline", points: [[cx - 6, cy - 6], [cx, cy], [cx - 6, cy + 6]], style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
      { kind: "polyline", points: [[cx, cy - 6], [cx + 6, cy], [cx, cy + 6]], style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
    ];
    if (detail) {
      // 细节层：两侧法兰对（左右各双竖短线，低对比 textMuted，缩小自然弱化）
      const lx = cx - R - PIPE + FLANGE_X; // 左侧法兰对靠管段端
      const rx = cx + R + PIPE - FLANGE_X; // 右侧法兰对靠管段端
      out.push(
        { kind: "line", x1: lx, y1: cy - FLANGE_H, x2: lx, y2: cy + FLANGE_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: lx + 3, y1: cy - FLANGE_H, x2: lx + 3, y2: cy + FLANGE_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: rx, y1: cy - FLANGE_H, x2: rx, y2: cy + FLANGE_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: rx - 3, y1: cy - FLANGE_H, x2: rx - 3, y2: cy + FLANGE_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
    }
    out.push(...labelAndInline(node, state, theme, cy + R + 16));
    return out;
  },
};
