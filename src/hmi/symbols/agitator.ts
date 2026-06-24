import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";

// 顶置搅拌器（独立件，可叠加在容器上）：电机箱 + 减速箱两级矩形（上小下大叠放）
// + 竖轴 + 双层桨叶（上层直叶横线、下层斜叶为细节层）。
// node.y = 件体竖向中心；驱动头在上、桨叶在下，约 W30×H64。
const MOTOR_W = 18; // 电机箱宽（上级·小）
const MOTOR_H = 12; // 电机箱高
const GEAR_W = 24; // 减速箱宽（下级·大）
const GEAR_H = 14; // 减速箱高
const SHAFT_LEN = 40; // 搅拌轴竖直长度（减速箱底 → 桨叶处）
const TOP_BLADE = 11; // 上层直叶半跨（水平投影）
const LOW_BLADE = 8; // 下层斜叶半跨（细节层）

export const agitator: SymbolDef = {
  type: "agitator",
  inlineFields: ["rpm"],
  bounds: (node) => {
    const driveH = MOTOR_H + GEAR_H; // 驱动头总高（两级矩形叠放）
    const boxTop = node.y - SHAFT_LEN / 2 - driveH;
    const bottom = node.y + SHAFT_LEN / 2 + 6; // 桨叶最低点略余量
    const halfW = Math.max(GEAR_W / 2, TOP_BLADE) + 4;
    return { x: node.x - halfW, y: boxTop - 2, w: halfW * 2, h: bottom - boxTop + 4 };
  },
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const fill = state.running ? theme.running : theme.fillLight;
    const cx = node.x;
    const shaftBottom = node.y + SHAFT_LEN / 2; // 轴底（桨叶汇聚点）
    const gearBottom = node.y - SHAFT_LEN / 2; // 减速箱底（接轴顶）
    const gearTop = gearBottom - GEAR_H; // 减速箱顶
    const motorTop = gearTop - MOTOR_H; // 电机箱顶
    const detail = showDetail(scale);
    const blade = { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" as const };

    const out: Primitive[] = [
      // 电机箱（上级·小，running 时深填充·醒目）
      { kind: "rect", x: cx - MOTOR_W / 2, y: motorTop, w: MOTOR_W, h: MOTOR_H, r: 2, style: { fill, stroke: theme.stroke, strokeWidth: 2 } },
      // 减速箱（下级·大，与电机箱叠放）
      { kind: "rect", x: cx - GEAR_W / 2, y: gearTop, w: GEAR_W, h: GEAR_H, r: 2, style: { fill, stroke: theme.stroke, strokeWidth: 2 } },
      // 竖直搅拌轴（减速箱底 → 轴底）
      { kind: "line", x1: cx, y1: gearBottom, x2: cx, y2: shaftBottom, style: { stroke: theme.stroke, strokeWidth: 3, lineCap: "round" } },
      // 上层直叶（横线·桨叶辨识主特征，任何缩放都画）
      { kind: "line", x1: cx - TOP_BLADE, y1: shaftBottom - 12, x2: cx + TOP_BLADE, y2: shaftBottom - 12, style: blade },
    ];

    if (detail) {
      // 细节层：下层斜叶（左右各一片斜线，缩小后自然隐藏）+ 驱动头分级缝
      out.push(
        { kind: "line", x1: cx, y1: shaftBottom - 6, x2: cx - LOW_BLADE, y2: shaftBottom, style: blade },
        { kind: "line", x1: cx, y1: shaftBottom - 6, x2: cx + LOW_BLADE, y2: shaftBottom, style: blade },
        // 电机箱/减速箱分级处低对比横细线
        { kind: "line", x1: cx - GEAR_W / 2, y1: gearTop, x2: cx + GEAR_W / 2, y2: gearTop, style: { stroke: theme.textMuted, strokeWidth: 1 } },
      );
    }

    out.push(...labelAndInline(node, state, theme, shaftBottom + 16));
    return out;
  },
};
