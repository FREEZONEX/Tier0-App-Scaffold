import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

const W = 56; // 管壳长度
const H = 22; // 管壳高度
const STUB = 6; // 左右短管嘴长度
const ELEMENTS = 4; // 内部交叉混合元件段数
const FLANGE_GAP = 4; // 法兰对竖线相对壳壁的内/外偏移
const FLANGE_OVER = 3; // 法兰竖线高出壳壁

/**
 * 静态混合器：水平管段 + 内部交叉 X 斜线混合元件 + 两端法兰对竖线（细节层）。
 * 纯结构连接件——无开关/运行态，沿管路坐实在线（无 inlineFields）。
 */
export const mixer: SymbolDef = {
  type: "mixer",
  bounds: (node) => ({ x: node.x - W / 2 - STUB - 1, y: node.y - H / 2 - FLANGE_OVER - 1, w: W + (STUB + 1) * 2, h: H + (FLANGE_OVER + 1) * 2 }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const left = node.x - W / 2;
    const right = left + W;
    const top = node.y - H / 2;
    const bottom = top + H;
    const cy = node.y;
    const detail = showDetail(scale);
    const stub = { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" as const };
    const out: Primitive[] = [
      // 左右短管嘴：坐实在线管段元件（基础形体）
      { kind: "line", x1: left - STUB, y1: cy, x2: left, y2: cy, style: stub },
      { kind: "line", x1: right, y1: cy, x2: right + STUB, y2: cy, style: stub },
      // 水平矩形管壳（基础形体）
      { kind: "rect", x: left, y: top, w: W, h: H, r: 2, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    // 内部交叉 X 混合元件 = 辨识特征：每段画一个 X（两条对角斜线）。状态层（任何缩放都画）
    const seg = W / ELEMENTS;
    const inset = 2; // 斜线相对壳壁内缩，避免压在描边上
    const yTop = top + inset;
    const yBot = bottom - inset;
    const x = (i: number) => left + i * seg;
    const mixStyle = { stroke: theme.stroke, strokeWidth: 1.5, lineCap: "round" as const };
    for (let i = 0; i < ELEMENTS; i++) {
      const x0 = x(i) + inset;
      const x1 = x(i + 1) - inset;
      // 一条 "\" + 一条 "/" 构成 X 交叉混合元件
      out.push({ kind: "line", x1: x0, y1: yTop, x2: x1, y2: yBot, style: mixStyle });
      out.push({ kind: "line", x1: x0, y1: yBot, x2: x1, y2: yTop, style: mixStyle });
    }
    if (detail) {
      // 细节层：管段两端法兰对竖线（左右各一对短竖线，低对比 textMuted，缩小自然弱化）
      const flange = { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" as const };
      const fyTop = top - FLANGE_OVER;
      const fyBot = bottom + FLANGE_OVER;
      const leftA = left + FLANGE_GAP;
      const leftB = left - FLANGE_GAP;
      const rightA = right - FLANGE_GAP;
      const rightB = right + FLANGE_GAP;
      out.push(
        // 左端法兰一对
        { kind: "line", x1: leftB, y1: fyTop, x2: leftB, y2: fyBot, style: flange },
        { kind: "line", x1: leftA, y1: fyTop, x2: leftA, y2: fyBot, style: flange },
        // 右端法兰一对
        { kind: "line", x1: rightA, y1: fyTop, x2: rightA, y2: fyBot, style: flange },
        { kind: "line", x1: rightB, y1: fyTop, x2: rightB, y2: fyBot, style: flange },
      );
    }
    out.push(...labelAndInline(node, state, theme, bottom + FLANGE_OVER + 16));
    return out;
  },
};
