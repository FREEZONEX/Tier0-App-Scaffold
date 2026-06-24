import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { showDetail } from "./lod";
import { labelAndInline } from "./labels";

const W = 64; // 壳体矩形宽（不含两端管箱封头）
const H = 30; // 壳体矩形高
const HEAD = 7; // 两端管箱（椭圆弧封头）外凸量
const NOZ_H = 7; // 上下管嘴短管伸出量
const LABEL_GAP = 16; // 位号/内联值距壳体底边

export const exchanger: SymbolDef = {
  type: "exchanger",
  inlineFields: ["temp"],
  // 命中框：左右各 +HEAD 覆盖管箱封头，上下各 +NOZ_H 覆盖 4 管嘴。锚点 node.x/y 居中于壳体。
  bounds: (node) => ({
    x: node.x - W / 2 - HEAD,
    y: node.y - H / 2 - NOZ_H,
    w: W + HEAD * 2,
    h: H + NOZ_H * 2,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const left = node.x - W / 2;
    const right = left + W;
    const top = node.y - H / 2;
    const bottom = top + H;
    const cy = node.y;
    const detail = showDetail(scale);
    const out: Primitive[] = [];

    // 壳体矩形（基础形体）
    out.push({
      kind: "rect",
      x: left,
      y: top,
      w: W,
      h: H,
      r: 2,
      style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
    });

    // 两端管箱：椭圆弧封头（path 二次贝塞尔，外凸 HEAD），换热器辨识特征
    out.push({
      kind: "path",
      d: [
        { c: "M", x: left, y: top },
        { c: "Q", x1: left - HEAD * 1.8, y1: cy, x: left, y: bottom },
      ],
      close: true,
      style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
    });
    out.push({
      kind: "path",
      d: [
        { c: "M", x: right, y: top },
        { c: "Q", x1: right + HEAD * 1.8, y1: cy, x: right, y: bottom },
      ],
      close: true,
      style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
    });

    // 管板竖线 ×2（壳体内两端各一道，分隔管箱与管束）= 换热器标志
    const tubeSheetL = left + 9;
    const tubeSheetR = right - 9;
    out.push({ kind: "line", x1: tubeSheetL, y1: top, x2: tubeSheetL, y2: bottom, style: { stroke: theme.stroke, strokeWidth: 2 } });
    out.push({ kind: "line", x1: tubeSheetR, y1: top, x2: tubeSheetR, y2: bottom, style: { stroke: theme.stroke, strokeWidth: 2 } });

    // 上下 4 管嘴（基础形体：壳侧/管侧进出口）
    const nz = { stroke: theme.stroke, strokeWidth: 2.5, lineCap: "round" as const };
    const nozIn = left + 5; // 左侧管箱接管（上下）
    const nozOut = right - 5; // 右侧管箱接管（上下）
    out.push({ kind: "line", x1: nozIn, y1: top, x2: nozIn, y2: top - NOZ_H, style: nz });
    out.push({ kind: "line", x1: nozIn, y1: bottom, x2: nozIn, y2: bottom + NOZ_H, style: nz });
    out.push({ kind: "line", x1: nozOut, y1: top, x2: nozOut, y2: top - NOZ_H, style: nz });
    out.push({ kind: "line", x1: nozOut, y1: bottom, x2: nozOut, y2: bottom + NOZ_H, style: nz });

    if (detail) {
      // 细节层：3 道交错折流板竖细线（上下交错、不到顶/底），低对比 textMuted
      const span = tubeSheetR - tubeSheetL;
      const baffleN = 3;
      const inset = 5; // 折流板距壳体顶/底的缺口
      for (let i = 0; i < baffleN; i++) {
        const bx = tubeSheetL + (span * (i + 1)) / (baffleN + 1);
        // 交错：偶数自顶向下留底缺口，奇数自底向上留顶缺口
        const fromTop = i % 2 === 0;
        const y1 = fromTop ? top : top + inset;
        const y2 = fromTop ? bottom - inset : bottom;
        out.push({ kind: "line", x1: bx, y1, x2: bx, y2, style: { stroke: theme.textMuted, strokeWidth: 1 } });
      }
    }

    out.push(...labelAndInline(node, state, theme, bottom + LABEL_GAP));
    return out;
  },
};
