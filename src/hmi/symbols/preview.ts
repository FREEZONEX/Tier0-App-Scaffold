import type { Capability } from "./capabilities";
import type { NodeState } from "../scene/scene";

/** 数值字段在预览里的示例值（仅展示）。 */
const NUM_DEMO: Record<string, number> = { level: 65, value: 60, temp: 72, flow: 42, dp: 30, rpm: 90, opening: 70 };
/** 数值字段的「低 / 高」演示值，让填充/读数类图元展示实际范围（而非冻结在单值）。 */
const NUM_RANGE: Record<string, readonly [number, number]> = {
  level: [18, 92], opening: [0, 90], value: [20, 85], flow: [15, 85], dp: [8, 72], temp: [30, 95], rpm: [25, 95],
};
const BOOL_LABEL: Record<string, readonly [string, string]> = {
  open: ["关", "开"], running: ["停止", "运行"], closed: ["断开", "闭合"],
};
/** 各类型在预览中带的静态 props（搅拌器/表盘面/仪表位号）。 */
export const PREVIEW_PROPS: Record<string, Record<string, unknown>> = {
  vessel: { agitator: true }, dialgauge: { face: "P" }, instrument: { tag: "FT" },
};

export interface PreviewVariant {
  readonly label: string;
  readonly state: NodeState;
  readonly props?: Record<string, unknown>;
}

/** 据契约构造 NodeState：running 走标志位，其余走 values；数值字段填示例值。 */
export function makeState(
  cap: Capability,
  set: Record<string, boolean>,
  numOverride: Record<string, number> = {},
): NodeState {
  const values: Record<string, unknown> = {};
  for (const s of cap.states) if (s.kind === "number") values[s.key] = numOverride[s.key] ?? NUM_DEMO[s.key] ?? 50;
  let running = false;
  for (const [k, v] of Object.entries(set)) {
    if (k === "running") running = v;
    else values[k] = v;
  }
  return { values, running, fault: false, stale: false };
}

/**
 * 代表性状态：布尔→开/关两态，数值→低/高两端（演示填充/读数范围），无状态→正常。
 * 故障/失联等异常态属通用视觉语言（红环/虚化/角标，与图元形状无关），统一在状态图例
 * （StateLegend）一处展示，预览不逐元件重复——避免环按图元长宽裁剪导致每个长得不一样。
 */
export function previewVariants(cap: Capability): PreviewVariant[] {
  const props = PREVIEW_PROPS[cap.type];
  const out: PreviewVariant[] = [];
  const primaryBool = cap.states.find((s) => s.kind === "boolean");
  const primaryNum = cap.states.find((s) => s.kind === "number");
  if (primaryBool) {
    const [offL, onL] = BOOL_LABEL[primaryBool.key] ?? ["关", "开"];
    out.push({ label: offL, state: makeState(cap, { [primaryBool.key]: false }), props });
    out.push({ label: onL, state: makeState(cap, { [primaryBool.key]: true }), props });
  } else if (primaryNum) {
    // 数值类（液位/开度/读数）：展示低、高两端，看到填充/指针的实际范围，而非冻结在单值。
    const [lo, hi] = NUM_RANGE[primaryNum.key] ?? [20, 85];
    const unit = primaryNum.unit ?? "";
    out.push({ label: `${lo}${unit}`, state: makeState(cap, {}, { [primaryNum.key]: lo }), props });
    out.push({ label: `${hi}${unit}`, state: makeState(cap, {}, { [primaryNum.key]: hi }), props });
  } else {
    out.push({ label: "正常", state: makeState(cap, {}), props });
  }
  return out;
}
