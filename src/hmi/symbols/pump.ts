import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

// 离心泵蜗壳（仿 OpenBridge，"蜗牛"形）：圆壳轮廓在右上方一体延伸出"水平"切向出料口
// （一条连续闭合 path，无断口）+ 壳内叶轮小圆 + 底部平底座。
const R = 15; // 蜗壳casing 半径（命中按此圆，circular: true）
const EYE_R = 5; // 叶轮impeller 内圈半径
const NOZ_TOP = 12; // 喷口上沿距圆心（向上）
const NOZ_BOT = 4; // 喷口下沿距圆心（向上）
const NOZ_LEN = 11; // 喷口水平外伸长度
const BASE_HW = 12; // 底座半宽
const BASE_H = 5; // 底座高

export const pump: SymbolDef = {
  type: "pump",
  lrOnly: true,
  inlineFields: ["rpm"],
  circular: true,
  // 背板齐蜗壳壳体（R）收口连线：bounds 因喷口/底座撑到 ~26（min/2），不显式给出会留环形缝。
  coreRadius: R,
  bounds: (node) => ({
    x: node.x - R - 4,
    y: node.y - R - NOZ_TOP - 4,
    w: 2 * R + NOZ_LEN + 12,
    h: 2 * R + BASE_H + 28,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const running = state.running;
    const fill = running ? theme.running : theme.fillLight;
    const eye = running ? theme.fillLight : theme.stroke; // 绿壳上浅描，停止时深描
    const cx = node.x;
    const cy = node.y;
    const topY = cy - NOZ_TOP; // 喷口上沿（水平）
    const botY = cy - NOZ_BOT; // 喷口下沿（水平）
    const xt = cx + Math.sqrt(R * R - NOZ_TOP * NOZ_TOP); // 上沿与圆相交 x
    const xb = cx + Math.sqrt(R * R - NOZ_BOT * NOZ_BOT); // 下沿与圆相交 x
    const at = Math.atan2(-NOZ_TOP, xt - cx); // 上沿交点角
    const ab = Math.atan2(-NOZ_BOT, xb - cx); // 下沿交点角
    const flangeX = cx + R + NOZ_LEN; // 喷口外端（法兰面）
    const baseY = cy + R - 2; // 底座顶（蜗壳坐落其上）
    const detail = showDetail(scale);
    const out: Primitive[] = [
      // 底座：平底板（蜗壳坐落其上，先画 → 蜗壳压住其上缘）
      { kind: "rect", x: cx - BASE_HW, y: baseY, w: BASE_HW * 2, h: BASE_H, r: 1, style: { fill, stroke: theme.stroke, strokeWidth: 2 } },
      // 蜗壳一体轮廓：上沿→法兰面→下沿→长圆弧绕回（似蜗牛口，水平排出），一笔闭合无断口
      {
        kind: "path",
        d: [
          { c: "M", x: xt, y: topY },
          { c: "L", x: flangeX, y: topY },
          { c: "L", x: flangeX, y: botY },
          { c: "L", x: xb, y: botY },
          { c: "A", cx, cy, r: R, a0: ab, a1: at + Math.PI * 2, ccw: false },
        ],
        close: true,
        style: { fill, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 叶轮impeller：壳内小圆
      { kind: "circle", cx, cy, r: EYE_R, style: { stroke: eye, strokeWidth: 2 } },
    ];
    if (detail) {
      // 细节层：底座下地面斜影线（低对比）
      for (const dx of [-8, 0, 8]) {
        out.push({ kind: "line", x1: cx + dx, y1: baseY + BASE_H, x2: cx + dx - 4, y2: baseY + BASE_H + 4, style: { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" } });
      }
    }
    out.push(...labelAndInline(node, state, theme, baseY + BASE_H + 16));
    return out;
  },
};
