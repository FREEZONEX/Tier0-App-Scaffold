import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

// 机壳外接半径（bounds/命中仍按外接圆，circular 保 true）。
const R = 24;
// 楔形机壳：左宽右窄的梯形（气体压缩，区别于泵的三角叶轮）。
const WEDGE_L = 14; // 左侧半高（宽端）
const WEDGE_R = 6; // 右侧半高（窄端）
const WEDGE_X = 14; // 楔形横向半跨
// 进出口管嘴：上下错位（入口低、出口高），两个小矩形管嘴。
const NOZ_W = 7;
const NOZ_H = 8;
const NOZ_Y_OFF = 9; // 管嘴中心相对锚点的纵向错位量
// 底座垫块（细节层）。
const BASE_W = 34;
const BASE_H = 6;

export const compressor: SymbolDef = {
  type: "compressor",
  inlineFields: ["rpm"],
  circular: true,
  bounds: (node) => ({ x: node.x - R - 2, y: node.y - R - 2, w: (R + 2) * 2, h: (R + 2) * 2 }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const fill = state.running ? theme.running : theme.fillLight;
    // 楔形描边色：运行时浅色压在深机壳上、静止时用主描边色勾形。
    const wedge = state.running ? theme.fillLight : theme.stroke;
    const cx = node.x;
    const cy = node.y;
    const detail = showDetail(scale);
    const out: Primitive[] = [
      // 进口管嘴（低）：左侧偏下的小矩形（结构件，不随状态变色）
      {
        kind: "rect",
        x: cx - R - 2,
        y: cy + NOZ_Y_OFF - NOZ_H / 2,
        w: NOZ_W,
        h: NOZ_H,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 出口管嘴（高）：右侧偏上的小矩形（结构件，不随状态变色）
      {
        kind: "rect",
        x: cx + R - NOZ_W + 2,
        y: cy - NOZ_Y_OFF - NOZ_H / 2,
        w: NOZ_W,
        h: NOZ_H,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 机壳外接圆（状态填充语义不变：running→fillDeep / 静止→fillLight）
      { kind: "circle", cx, cy, r: R, style: { fill, stroke: theme.stroke, strokeWidth: 2 } },
      // 楔形机壳（左宽右窄）= 气体压缩辨识特征
      {
        kind: "polygon",
        points: [
          [cx - WEDGE_X, cy - WEDGE_L],
          [cx - WEDGE_X, cy + WEDGE_L],
          [cx + WEDGE_X, cy + WEDGE_R],
          [cx + WEDGE_X, cy - WEDGE_R],
        ],
        style: state.running ? { fill: wedge } : { stroke: wedge, strokeWidth: 2 },
      },
    ];
    if (detail) {
      // 细节层（低对比 textMuted，缩小自然弱化）：底座垫块 + 中心轴端小圆
      out.push(
        { kind: "rect", x: cx - BASE_W / 2, y: cy + R - 1, w: BASE_W, h: BASE_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "circle", cx, cy, r: 2.5, style: { stroke: theme.textMuted, strokeWidth: 1 } },
      );
    }
    out.push(...labelAndInline(node, state, theme, cy + R + BASE_H + 14));
    return out;
  },
};
