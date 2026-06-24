import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

const W = 30; // 立式壳体宽（窄高造型，区别于横卧矩形）
const H = 44; // 立式壳体高
const NOZ = 6; // 上进/下出管嘴外伸长度
const CAP_GAP = 4; // 快开顶盖横线距壳顶
const LABEL_GAP = 16;

/**
 * 过滤器：立式壳体 + 内部滤芯竖纹 3 道（细节层）、上进下出管嘴、快开顶盖横线
 * （壳顶一道横线示意法兰盖）。被动元件，无开关态；堵塞由报警装饰体现。
 */
export const filter: SymbolDef = {
  type: "filter",
  inlineFields: ["dp"],
  // 命中框：上覆进口管嘴，下覆出口管嘴+位号。锚点 node.x/y 视觉居中于壳体。
  bounds: (node) => ({
    x: node.x - W / 2,
    y: node.y - H / 2 - NOZ,
    w: W,
    h: H + NOZ * 2,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const left = node.x - W / 2;
    const top = node.y - H / 2;
    const bottom = top + H;
    const right = left + W;
    const cx = node.x;
    const detail = showDetail(scale);
    const out: Primitive[] = [
      // 上进管嘴（壳顶居中外伸）
      { kind: "line", x1: cx, y1: top - NOZ, x2: cx, y2: top, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } },
      // 下出管嘴（壳底居中外伸）
      { kind: "line", x1: cx, y1: bottom, x2: cx, y2: bottom + NOZ, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } },
      // 立式壳体
      { kind: "rect", x: left, y: top, w: W, h: H, r: 3, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    if (detail) {
      // 细节层（低对比 textMuted，缩小自然弱化）：
      // ① 快开顶盖：壳顶一道横细线示意法兰盖
      out.push({
        kind: "line",
        x1: left,
        y1: top + CAP_GAP,
        x2: right,
        y2: top + CAP_GAP,
        style: { stroke: theme.textMuted, strokeWidth: 1.25 },
      });
      // ② 内部滤芯：3 道竖纹（裁到盖线以下、壳底以上）
      const vTop = top + CAP_GAP + 3;
      const vBottom = bottom - 4;
      for (let i = 1; i <= 3; i++) {
        const vx = left + (W * i) / 4;
        out.push({ kind: "line", x1: vx, y1: vTop, x2: vx, y2: vBottom, style: { stroke: theme.textMuted, strokeWidth: 1 } });
      }
    }
    out.push(...labelAndInline(node, state, theme, bottom + NOZ + LABEL_GAP));
    return out;
  },
};
