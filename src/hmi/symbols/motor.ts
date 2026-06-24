import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

// 机身：圆角矩形（卧式电机外形）。锚点 node.x/y 视觉居中于机身。
const BODY_W = 44; // 机身宽（轴向）
const BODY_H = 34; // 机身高（径向）
const BODY_R = 4; // 圆角半径
const TERM_W = 16; // 顶部接线盒宽
const TERM_H = 9; // 顶部接线盒高
const SHAFT_LEN = 12; // 右侧轴伸长（伸出机身）
const ENDCAP_INSET = 6; // 端盖竖线距机身左右内缩
const FIN_COUNT = 4; // 散热筋横细线条数

/** 电机：卧式机身（圆角矩形）+ 端盖竖线 + 顶部接线盒 + 散热筋 + 右侧轴伸，运行=深填充。 */
export const motor: SymbolDef = {
  type: "motor",
  inlineFields: ["rpm"],
  circular: true,
  // 命中框：上覆接线盒+位号留白，右覆轴伸，下覆内联值。锚点仍视觉居中于机身。
  bounds: (node) => ({
    x: node.x - BODY_W / 2 - 2,
    y: node.y - BODY_H / 2 - TERM_H - 14,
    w: BODY_W + 4 + SHAFT_LEN,
    h: BODY_H + TERM_H + 14 + 30,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const fill = state.running ? theme.running : theme.fillLight;
    const cx = node.x;
    const cy = node.y;
    const left = cx - BODY_W / 2;
    const top = cy - BODY_H / 2;
    const right = left + BODY_W;
    const bottom = top + BODY_H;
    const detail = showDetail(scale);
    const out: Primitive[] = [
      // 右侧轴伸：伸出机身的短粗线（电机辨识特征，结构不随状态变色）
      { kind: "line", x1: right, y1: cy, x2: right + SHAFT_LEN, y2: cy, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } },
      // 顶部接线盒小方块（电气特征）
      { kind: "rect", x: cx - TERM_W / 2, y: top - TERM_H, w: TERM_W, h: TERM_H + 2, r: 1, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
      // 机身：圆角矩形，运行=深填充（状态层）
      { kind: "rect", x: left, y: top, w: BODY_W, h: BODY_H, r: BODY_R, style: { fill, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    if (detail) {
      // 细节层：左右端盖竖线 + 散热筋 N 道横细线（低对比 textMuted，缩小自然弱化）
      out.push(
        { kind: "line", x1: left + ENDCAP_INSET, y1: top, x2: left + ENDCAP_INSET, y2: bottom, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: right - ENDCAP_INSET, y1: top, x2: right - ENDCAP_INSET, y2: bottom, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
      const finLeft = left + ENDCAP_INSET + 2;
      const finRight = right - ENDCAP_INSET - 2;
      for (let i = 1; i <= FIN_COUNT; i++) {
        const fy = top + (BODY_H * i) / (FIN_COUNT + 1);
        out.push({ kind: "line", x1: finLeft, y1: fy, x2: finRight, y2: fy, style: { stroke: theme.textMuted, strokeWidth: 1 } });
      }
    }
    out.push(...labelAndInline(node, state, theme, bottom + 16));
    return out;
  },
};
