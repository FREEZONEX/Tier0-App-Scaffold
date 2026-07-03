import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";

// 简洁方向箭头端子：一条箭身 + 实心三角箭头（指向料流方向），即「──▶」。rotation 定朝向。
const L = 46; // 箭头总长（箭身 + 箭头）
const TIP = 16; // 箭头头部长度
const HEAD_H = 11; // 箭头头部半高
const SHAFT_W = 3; // 箭身线宽

/**
 * 工艺边界端子（物料出入口）：FEED 进料 / 去 TK / 放空 / 公用工程等管网边界。
 * 简洁箭头指向料流方向；label 显名（FEED/TK-001…），inline 显流量。
 * 不承载运行态——边界本身无开关；流量由 flow 绑定驱动内联显示。
 * noFade：边界端子很少接 MQTT，未配置/失联不褪色虚化（见 scene-render）。
 */
export const terminal: SymbolDef = {
  type: "terminal",
  inlineFields: ["flow"],
  noFade: true,
  bounds: (node) => ({
    x: node.x - L / 2,
    y: node.y - HEAD_H,
    w: L,
    h: HEAD_H * 2 + 16, // 下留 label/inline 行
  }),
  // 真实图形轮廓（箭身+箭头，不含 bounds 里为下方文字多留的 +16）。
  coreBox: (node) => ({ x: node.x - L / 2, y: node.y - HEAD_H, w: L, h: HEAD_H * 2 }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const left = cx - L / 2;
    const right = cx + L / 2;
    const headBase = right - TIP;

    const out: Primitive[] = [
      // 箭身
      { kind: "line", x1: left, y1: cy, x2: headBase, y2: cy, style: { stroke: theme.stroke, strokeWidth: SHAFT_W, lineCap: "round" } },
      // 实心三角箭头（指向料流方向）
      {
        kind: "polygon",
        points: [
          [headBase, cy - HEAD_H],
          [right, cy],
          [headBase, cy + HEAD_H],
        ],
        style: { fill: theme.stroke, stroke: theme.stroke, strokeWidth: 1 },
      },
    ];
    out.push(...labelAndInline(node, state, theme, cy + HEAD_H + 13));
    return out;
  },
};
