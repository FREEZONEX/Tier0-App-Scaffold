import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";
import { SPIN_PERIOD_MS } from "./spin";

const W = 64; // 管束宽（footprint：连线贴边/命中/背板依赖）
const H = 30; // 管束高
const FAN_R = 13; // 顶置风机圆半径
const FAN_GAP = 4; // 风机圆底缘与管束顶之间的间隙
const NOZ_H = 7; // 顶部冷却介质接管短管
const LEG_H = 12; // 两侧支架腿（细节层）
const BLADE_N = 6; // 风机叶片放射短线数（细节层）

/**
 * 空冷器（Air Cooler）：顶置轴流风机圆 + 下方翅片管束 + 两侧支架腿。
 * 基础形体：管束矩形 + 风机圆（圆=状态层，运行=fillLight 亮色 / 静止=textMuted 暗色）。
 * 细节层：风机叶片放射短线、管束水平细线（3~4 横线）、两侧支架腿。
 * 异常色（fault/alarm/stale）由上层装饰层负责，symbol 不画。
 */
export const cooler: SymbolDef = {
  type: "cooler",
  inlineFields: ["temp"],
  // 命中框：上覆风机圆+接管，下覆支架腿+位号。锚点 node.x/y 仍视觉居中于管束。
  bounds: (node) => {
    const fanTop = FAN_R * 2 + FAN_GAP + NOZ_H; // 管束顶之上：风机直径 + 间隙 + 接管
    return {
      x: node.x - W / 2,
      y: node.y - H / 2 - fanTop,
      w: W,
      h: H + fanTop + LEG_H + 30, // 下方支腿 + 标签/内联两行
    };
  },
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const left = cx - W / 2;
    const right = left + W;
    const top = cy - H / 2;
    const bottom = top + H;
    const detail = showDetail(scale);
    // 风机圆心：管束上方
    const fanCy = top - FAN_GAP - FAN_R;
    // 状态层：风机圆填充——运行=绿(running)，静止=白底 fillLight
    const fanFill = state.running ? theme.running : theme.fillLight;

    const out: Primitive[] = [
      // 翅片管束（基础形体：外轮廓 strokeWidth 2）：running→整体绿 / 静止→浅
      { kind: "rect", x: left, y: top, w: W, h: H, r: 3, style: { fill: state.running ? theme.running : theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
      // 顶置风机圆（基础形体 + 状态层）
      { kind: "circle", cx, cy: fanCy, r: FAN_R, style: { fill: fanFill, stroke: theme.stroke, strokeWidth: 2 } },
    ];

    // 顶部冷却介质接管短管（风机圆顶引出，基础形体辨识特征）
    const nz = { stroke: theme.stroke, strokeWidth: 2, lineCap: "round" as const };
    out.push({ kind: "line", x1: cx, y1: fanCy - FAN_R, x2: cx, y2: fanCy - FAN_R - NOZ_H, style: nz });

    if (detail) {
      // 风机叶片：圆内放射短线（低对比 textMuted，缩小自然弱化）。
      // 运行时整组绕风机圆心 (cx,fanCy) 自转（painter 按 spinPeriod），复用 fan 同款机制与周期。
      const blades: Primitive[] = [];
      for (let i = 0; i < BLADE_N; i++) {
        const a = (Math.PI * 2 * i) / BLADE_N;
        const inner = FAN_R * 0.25;
        const outer = FAN_R * 0.82;
        blades.push({
          kind: "line",
          x1: cx + Math.cos(a) * inner,
          y1: fanCy + Math.sin(a) * inner,
          x2: cx + Math.cos(a) * outer,
          y2: fanCy + Math.sin(a) * outer,
          style: { stroke: state.running ? theme.fillLight : theme.textMuted, strokeWidth: 1.25 },
        });
      }
      if (state.running) out.push({ kind: "rotate", cx, cy: fanCy, deg: 0, spinPeriod: SPIN_PERIOD_MS, children: blades });
      else out.push(...blades);
      // 管束水平细线层（3 横线）：running 绿底上反白，静止低对比
      for (let i = 1; i <= 3; i++) {
        const y = top + (H * i) / 4;
        out.push({ kind: "line", x1: left + 5, y1: y, x2: right - 5, y2: y, style: { stroke: state.running ? theme.fillLight : theme.textMuted, strokeWidth: 1 } });
      }
      // 两侧支架腿（外八字，低对比）
      out.push(
        { kind: "line", x1: left + W * 0.18, y1: bottom, x2: left + W * 0.18 - 3, y2: bottom + LEG_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: right - W * 0.18, y1: bottom, x2: right - W * 0.18 + 3, y2: bottom + LEG_H, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
    }

    out.push(...labelAndInline(node, state, theme, bottom + LEG_H + 14));
    return out;
  },
};
