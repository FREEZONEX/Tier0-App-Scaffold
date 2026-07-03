import type { SymbolDef, SymbolContext } from "./registry";
import type { Primitive } from "../engine/primitives";
import type { NodeState } from "../scene/scene";
import { labelAndInline } from "./labels";
import { showDetail } from "./lod";
import { fillPct } from "./fill";
import { toBool } from "../shared/coerce";

const HW = 18; // 触点半距（固定触点中心到锚点）
const TERM_R = 3.5; // 固定触点小圆半径
const LEAD = 8; // 端子引线长度（细节层）
const BLADE_L = HW * 2; // 刀片长 = 两触点间距（铰接在左触点，自由端落在右触点=闭合）
const MAX_OPEN_DEG = 55; // opening=0（完全断开）时刀片抬角
const MAX_LIFT = BLADE_L * Math.sin((MAX_OPEN_DEG * Math.PI) / 180); // 命中框上沿预留（断开态最高抬起）

/** 开合度 0–100 → 刀片相对水平抬角(°)：100=0°(闭合平直)、0=MAX_OPEN_DEG(断开最大抬角)，线性。 */
export function bladeAngleDeg(opening: number): number {
  const o = Math.max(0, Math.min(100, opening));
  return MAX_OPEN_DEG * (1 - o / 100);
}

/** 读开合度：主字段 opening（数值/量程比例）；兼容旧布尔绑定 closed/on/running → 闭合=100、断开=0。 */
function openingOf(state: NodeState): number {
  if (state.fractions?.opening !== undefined || typeof state.values.opening === "number") {
    return fillPct(state, "opening");
  }
  const legacy = state.values.closed ?? state.values.on ?? state.values.running;
  if (legacy !== undefined) return toBool(legacy) ? 100 : 0;
  return 0; // 默认断开
}

/**
 * 电气刀闸开关：固定触点小圆×2（左右）+ 可动刀片（铰接左触点）。
 * 刀片抬角随开合度 opening(0–100) 连续摆动：100=平直闭合（自由端触达右触点），
 * 0=抬至最大角（断开），中间值=按比例的中间抬角。
 * 着色：opening=0 用默认色（stroke）、>0 用绿（与泵/阀「激活=绿」一致）。
 * 端子引线（细节层）：触点向外的短引线。异常色由上层装饰层负责。
 */
export const switchSymbol: SymbolDef = {
  type: "switch",
  inlineFields: ["opening"],
  // 命中框：左右覆盖端子引线外端，纵向覆盖断开态最高抬起的刀片 + 位号/内联两行。
  bounds: (node) => ({ x: node.x - HW - LEAD - 2, y: node.y - MAX_LIFT - 4, w: (HW + LEAD + 2) * 2, h: MAX_LIFT + 4 + 40 }),
  // 真实图形轮廓（不含 bounds 里为下方位号/内联两行文字多留的 +40）。
  // 底边下沉 TERM_R+3 覆盖固定触点小圆的下半段（触点圆心在 cy 水平线）——若底边停在 cy，
  // 触点露在环外，且本 symbol 的文字比惯例画得低（cy+22 起，为躲触点），按钮从 cy 起算会压住数值行。
  coreBox: (node) => ({ x: node.x - HW - LEAD - 2, y: node.y - MAX_LIFT - 4, w: (HW + LEAD + 2) * 2, h: MAX_LIFT + 4 + TERM_R + 3 }),
  build: ({ node, state, theme, scale }: SymbolContext): Primitive[] => {
    const cx = node.x;
    const cy = node.y;
    const lx = cx - HW; // 左固定触点（刀片铰接点）
    const rx = cx + HW; // 右固定触点
    const opening = openingOf(state);
    const conducting = opening > 0; // 着色：0=默认色、>0=绿（激活）
    const rad = (bladeAngleDeg(opening) * Math.PI) / 180;
    const detail = showDetail(scale);

    // 可动刀片：自由端绕左触点按抬角摆动（长度恒为 BLADE_L）。opening=100→平直触达右触点。
    const blade: Primitive = {
      kind: "line",
      x1: lx,
      y1: cy,
      x2: lx + BLADE_L * Math.cos(rad),
      y2: cy - BLADE_L * Math.sin(rad),
      style: { stroke: conducting ? theme.running : theme.stroke, strokeWidth: 3, lineCap: "round" },
    };

    // 固定触点小圆（基础形体：任何缩放都画）
    const term = (x: number): Primitive => ({ kind: "circle", cx: x, cy, r: TERM_R, style: { fill: theme.fillLight, stroke: theme.stroke, strokeWidth: 2 } });

    const out: Primitive[] = [blade, term(lx), term(rx)];

    if (detail) {
      // 端子引线：两触点向外的短引线（低对比 textMuted，缩小自然弱化）
      out.push(
        { kind: "line", x1: lx - TERM_R, y1: cy, x2: lx - LEAD, y2: cy, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
        { kind: "line", x1: rx + TERM_R, y1: cy, x2: rx + LEAD, y2: cy, style: { stroke: theme.textMuted, strokeWidth: 1.25 } },
      );
    }

    out.push(...labelAndInline(node, state, theme, cy + 22));
    return out;
  },
};
