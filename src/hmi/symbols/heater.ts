import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

const BODY_W = 60;
const BODY_H = 40;
const HALF_W = BODY_W / 2;
const HALF_H = BODY_H / 2;
const NOZZLE = 10;
const LEG_H = 9; // 底部支腿（细节层）
const FLANGE_H = 6; // 进出口管嘴法兰短竖线半高（细节层）
const SHELL_R = 5; // 外壳圆角，包住内部盘管

/** 内部锯齿形加热盘管：在本体内 padding 区域内来回折线（横向 4 段）。 */
function coilPoints(cx: number, cy: number): readonly (readonly [number, number])[] {
  const padX = 9;
  const padY = 9;
  const left = cx - HALF_W + padX;
  const right = cx + HALF_W - padX;
  const top = cy - HALF_H + padY;
  const bottom = cy + HALF_H - padY;
  const segments = 4; // 折线竖向往返条数
  const rowGap = (bottom - top) / (segments - 1);
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i < segments; i++) {
    const y = top + rowGap * i;
    // 偶数行从左到右，奇数行从右到左，形成连续锯齿往返
    if (i % 2 === 0) {
      pts.push([left, y], [right, y]);
    } else {
      pts.push([right, y], [left, y]);
    }
  }
  return pts;
}

export const heater: SymbolDef = {
  type: "heater",
  inlineFields: ["temp"],
  // 命中框：含两侧管嘴宽度 + 下覆支腿（细节层）；锚点 node.x/y 视觉居中于外壳。
  bounds: (node) => ({
    x: node.x - HALF_W - NOZZLE,
    y: node.y - HALF_H - 2,
    w: BODY_W + NOZZLE * 2,
    h: BODY_H + 4 + LEG_H,
  }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const left = cx - HALF_W;
    const right = cx + HALF_W;
    const bottom = cy + HALF_H;
    const detail = showDetail(scale);
    // 激活态外壳醒目（fillDeep），静止态浅填充
    const shellFill = state.running ? theme.running : theme.fillLight;
    // 盘管：running 时叠在深底上用浅色描出，静止用本体描边色
    const coilStroke: keyof Palette = state.running ? "fillLight" : "stroke";

    const out: Primitive[] = [
      // 左右进出管嘴（结构，不随状态变色）
      { kind: "line", x1: left - NOZZLE, y1: cy, x2: left, y2: cy, style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
      { kind: "line", x1: right, y1: cy, x2: right + NOZZLE, y2: cy, style: { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" } },
      // 加热器外壳：圆角矩形包住内部盘管
      { kind: "rect", x: left, y: cy - HALF_H, w: BODY_W, h: BODY_H, r: SHELL_R, style: { fill: shellFill, stroke: theme.stroke, strokeWidth: 2 } },
      // 内部锯齿形加热盘管 = 辨识特征（基础形体 + 状态层，任何缩放都画）
      { kind: "polyline", points: coilPoints(cx, cy), style: { stroke: theme[coilStroke], strokeWidth: 2, lineCap: "round" } },
    ];

    if (detail) {
      // 细节层（低对比 textMuted，缩小自然弱化）：
      // 进出口管嘴端部法兰短竖线 + 底部 2 支腿
      out.push(
        // 进口法兰短竖线
        { kind: "line", x1: left - NOZZLE, y1: cy - FLANGE_H, x2: left - NOZZLE, y2: cy + FLANGE_H, style: { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" } },
        // 出口法兰短竖线
        { kind: "line", x1: right + NOZZLE, y1: cy - FLANGE_H, x2: right + NOZZLE, y2: cy + FLANGE_H, style: { stroke: theme.textMuted, strokeWidth: 1.25, lineCap: "round" } },
        // 底部 2 支腿
        { kind: "line", x1: left + BODY_W * 0.22, y1: bottom, x2: left + BODY_W * 0.22 - 3, y2: bottom + LEG_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: right - BODY_W * 0.22, y1: bottom, x2: right - BODY_W * 0.22 + 3, y2: bottom + LEG_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
    }

    out.push(...labelAndInline(node, state, theme, bottom + LEG_H + 12));
    return out;
  },
};
