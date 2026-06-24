import type { SymbolDef, SymbolContext, } from "./registry";
import type { Primitive, PathCmd } from "../engine/primitives";
import { labelAndInline } from "./labels";
import { SPIN_PERIOD_MS } from "./spin";

const R = 20; // 外圈机壳半径
const HUB_R = 4; // 中心毂半径
const BLADE_R = 17; // 叶片外端半径（落在外圈内）
const BLADE_N = 3; // 桨叶数
const LABEL_GAP = 16;

/**
 * 轴流风机/风扇：外圈机壳 + 中心毂 + 3 片镰刀桨叶（petal）。
 * 桨叶 running=绿填充、静止=浅填充（描边勾形）；running 时整组绕中心自转（painter 按 spinPeriod）。
 * 异常色由上层装饰层负责。
 */
export const fan: SymbolDef = {
  type: "fan",
  inlineFields: ["rpm"],
  circular: true,
  bounds: (node) => ({ x: node.x - R - 2, y: node.y - R - 2, w: (R + 2) * 2, h: (R + 2) * 2 }),
  build: ({ node, state, theme }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const running = state.running;
    const bladeFill = theme.fillLight; // 桨叶恒浅填充靠描边勾形；运行时整圈绿、叶片反白
    // 绕中心旋转一点（把基准桨叶复制到 BLADE_N 个朝向）
    const rot = (px: number, py: number, a: number): [number, number] => {
      const dx = px - cx;
      const dy = py - cy;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return [cx + dx * c - dy * s, cy + dx * s + dy * c];
    };
    // 基准桨叶（指向上、向右扫掠的镰刀 petal）：两段二次贝塞尔围出叶形
    const bladePath = (a: number): PathCmd[] => {
      const P = (px: number, py: number) => {
        const [x, y] = rot(px, py, a);
        return { x, y };
      };
      const base = P(cx, cy - HUB_R);
      const tip = P(cx + 2, cy - BLADE_R);
      const outCtl = P(cx + 9, cy - BLADE_R * 0.5);
      const inCtl = P(cx - 4, cy - BLADE_R * 0.5);
      return [
        { c: "M", x: base.x, y: base.y },
        { c: "Q", x1: outCtl.x, y1: outCtl.y, x: tip.x, y: tip.y },
        { c: "Q", x1: inCtl.x, y1: inCtl.y, x: base.x, y: base.y },
      ];
    };

    const out: Primitive[] = [
      // 外圈机壳（轴流风机外环）：running→整圈绿 / 静止→浅
      { kind: "circle", cx, cy, r: R, style: { fill: running ? theme.running : theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } },
    ];
    // 3 片桨叶（填充叶形）。running 时整组绕中心自转
    const blades: Primitive[] = [];
    for (let i = 0; i < BLADE_N; i++) {
      blades.push({ kind: "path", d: bladePath((i * 2 * Math.PI) / BLADE_N), close: true, style: { fill: bladeFill, stroke: theme.stroke, strokeWidth: 1.5 } });
    }
    if (running) out.push({ kind: "rotate", cx, cy, deg: 0, spinPeriod: SPIN_PERIOD_MS, children: blades });
    else out.push(...blades);
    // 中心毂（静止小圆，压住桨叶汇聚点）
    out.push({ kind: "circle", cx, cy, r: HUB_R, style: { fill: theme.stroke } });

    out.push(...labelAndInline(node, state, theme, cy + R + LABEL_GAP));
    return out;
  },
};
