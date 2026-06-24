import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { fillPct } from "./fill";

const HW = 16; // 阀体半宽
const HH = 13; // 阀体半高

// 膜头执行器几何（半圆拱，位于阀体上方，经阀杆相连）
const STEM_H = 12; // 阀杆长度（阀体顶 → 膜头底/膜片）
const DOME_R = 13; // 膜头半圆拱半径（=膜片半宽）

// 阀体顶部 y、膜片（膜头底直径）y（cy 上方为负）
const bodyTopY = (cy: number): number => cy - HH;
const diaphY = (cy: number): number => bodyTopY(cy) - STEM_H; // 膜片横线 = 半圆拱底直径

// 整体顶部（拱顶）到中心的半高，供标签定位 / bounds 使用
const halfHeight = HH + STEM_H + DOME_R;

// 碟片（蝶阀阀瓣）半长：落在阀体包络内
const DISC_L = 11;

/**
 * 开度 0–100 → 碟片相对水平的倾角（°）：0%=90°（垂直挡流·全关）、100%=0°（顺流·全开），线性。
 * 与 opening 数值联动：数据变 → 角度变（重绘，非动画循环）。
 */
export function discAngleDeg(opening: number): number {
  const o = Math.max(0, Math.min(100, opening));
  return 90 * (1 - o / 100);
}

/**
 * 调节阀（control valve）：蝶形双三角阀体 + 顶部半圆拱膜头执行器 + 竖直阀杆。
 * 膜头（半圆拱 + 膜片横线）是区别于开关阀（switch valve）的关键标识。
 * 开度 opening(0..100)：>0 阀体深填充（带流/激活·醒目），=0 浅填充（静止）；碟片倾角随开度联动。
 */
export const controlvalve: SymbolDef = {
  type: "controlvalve",
  lrOnly: true,
  inlineFields: ["opening"],
  bounds: (node) => ({
    x: node.x - DOME_R - 2,
    y: node.y - halfHeight - 2,
    w: (DOME_R + 2) * 2,
    h: halfHeight + HH + 4,
  }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const opening = fillPct(state, "opening");
    // 碟片倾角随开度联动（弧度）。
    const discRad = (discAngleDeg(opening) * Math.PI) / 180;
    // 激活态（开度>0）= 深填充醒目；全关 = 浅填充静止。与泵/阀「激活=深填充」一致。
    const fill = opening > 0 ? theme.running : theme.fillLight;
    const cx = node.x;
    const cy = node.y;

    const bodyStyle = { fill, stroke: theme.stroke, strokeWidth: 2 };
    const stub = { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" as const };

    const topBody = bodyTopY(cy);
    const yDiaph = diaphY(cy);

    const out: Primitive[] = [
      // 左右管段接头：坐实"在线流通元件"
      { kind: "line", x1: cx - HW - 7, y1: cy, x2: cx - HW, y2: cy, style: stub },
      { kind: "line", x1: cx + HW, y1: cy, x2: cx + HW + 7, y2: cy, style: stub },
      // 蝶形双三角阀体（与开关阀同形）
      { kind: "polygon", points: [[cx - HW, cy - HH], [cx - HW, cy + HH], [cx, cy]], style: bodyStyle },
      { kind: "polygon", points: [[cx + HW, cy - HH], [cx + HW, cy + HH], [cx, cy]], style: bodyStyle },
      // 碟片（阀瓣）：贯穿阀芯，倾角随开度联动。全关=垂直挡流、全开=顺流。激活时反白、静止时深描。
      {
        kind: "line",
        x1: cx - DISC_L * Math.cos(discRad),
        y1: cy - DISC_L * Math.sin(discRad),
        x2: cx + DISC_L * Math.cos(discRad),
        y2: cy + DISC_L * Math.sin(discRad),
        style: { stroke: opening > 0 ? theme.fillLight : theme.stroke, strokeWidth: 3, lineCap: "round" },
      },
      // 竖直阀杆：阀体顶 → 膜片
      { kind: "line", x1: cx, y1: topBody, x2: cx, y2: yDiaph, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } },
      // 膜头执行器：半圆拱（path A 弧顶，左→右上半弧），区别于开关阀的关键标识。
      // A: 圆心 (cx, yDiaph)，半径 DOME_R，从 π（左端）到 0（右端），ccw=true 走上半弧。
      {
        kind: "path",
        d: [
          { c: "M", x: cx - DOME_R, y: yDiaph },
          { c: "A", cx, cy: yDiaph, r: DOME_R, a0: Math.PI, a1: 0, ccw: true },
        ],
        close: true,
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 膜片横线：半圆拱底直径（执行器膜片）
      { kind: "line", x1: cx - DOME_R, y1: yDiaph, x2: cx + DOME_R, y2: yDiaph, style: { stroke: theme.stroke, strokeWidth: 2 } },
    ];

    out.push(...labelAndInline(node, state, theme, cy + HH + 16));
    return out;
  },
};
