import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { fillPct } from "./fill";
import { showDetail } from "./lod";

const R = 26;
const START_DEG = 135; // value 0 指向左下
const SWEEP_DEG = 270; // 0→100 顺时针扫 270°
const ARC_R = R - 4; // 刻度弧半径（在外圈内侧）
const BASE_W = 18; // 表座顶宽
const BASE_H = 7; // 表座高度
const LABEL_GAP = 16; // 位号/读数距底边

function pointAt(cx: number, cy: number, deg: number, radius: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
}

/** 指针表盘：表盘 + 刻度弧 + 指针（value 0-100 映射到 270° 扫角），底部表座。 */
export const dialgauge: SymbolDef = {
  type: "dialgauge",
  inlineFields: ["value"],
  circular: true,
  // 命中框：外圈 + 底部表座（锚点 node.x/y 仍视觉居中于表盘圆）。
  bounds: (node) => ({
    x: node.x - R - 2,
    y: node.y - R - 2,
    w: (R + 2) * 2,
    h: (R + 2) * 2 + BASE_H,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const value = fillPct(state, "value");
    const detail = showDetail(scale);
    const out: Primitive[] = [
      // 底部表座小梯形（基础形体：仪表辨识特征，下边略窄）
      {
        kind: "polygon",
        points: [
          [cx - BASE_W / 2, cy + R],
          [cx + BASE_W / 2, cy + R],
          [cx + BASE_W / 2 - 3, cy + R + BASE_H],
          [cx - BASE_W / 2 + 3, cy + R + BASE_H],
        ],
        style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 },
      },
      // 表盘外圈
      { kind: "circle", cx, cy, r: R, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    // 面字母（P/T/ΔP）：区分压力/温度/差压表，消除仪表撞脸
    const face = typeof node.props?.face === "string" ? node.props.face : undefined;
    if (face) {
      out.push({ kind: "text", x: cx, y: cy - 6, text: face, style: { fill: theme.textMuted, font: "700 10px ui-sans-serif, system-ui", textAlign: "center" } });
    }
    if (detail) {
      // 细节层：刻度弧（path A 弧，沿量程 270°）+ 5 道刻度短线（低对比，缩小自然弱化）
      const a0 = (START_DEG * Math.PI) / 180;
      const a1 = ((START_DEG + SWEEP_DEG) * Math.PI) / 180;
      out.push({
        kind: "path",
        d: [{ c: "A", cx, cy, r: ARC_R, a0, a1 }],
        style: { stroke: theme.textMuted, strokeWidth: 1.25 },
      });
      for (let i = 0; i <= 4; i++) {
        const deg = START_DEG + (SWEEP_DEG * i) / 4;
        const [x1, y1] = pointAt(cx, cy, deg, ARC_R);
        const [x2, y2] = pointAt(cx, cy, deg, ARC_R - 5);
        out.push({ kind: "line", x1, y1, x2, y2, style: { stroke: theme.textMuted, strokeWidth: 1 } });
      }
    }
    // 指针（始终为最后一条 line：刻度线在 detail 层、它在其后）
    const [nx, ny] = pointAt(cx, cy, START_DEG + (SWEEP_DEG * value) / 100, R - 8);
    out.push({ kind: "line", x1: cx, y1: cy, x2: nx, y2: ny, style: { stroke: theme.stroke, strokeWidth: 2.5, lineCap: "round" } });
    // 指针根部小圆（轴心）
    out.push({ kind: "circle", cx, cy, r: 3, style: { fill: theme.stroke } });
    out.push(...labelAndInline(node, state, theme, cy + R + LABEL_GAP));
    return out;
  },
};
