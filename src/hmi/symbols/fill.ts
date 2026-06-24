import type { NodeState } from "../scene/scene";
import type { Primitive } from "../engine/primitives";
import { clampPct } from "../shared/coerce";

/**
 * 视觉填充比例 0–100：优先用 binding.scale 量程算出的 fraction（真实工程值映射到量程区间），
 * 无量程时按原值钳到 0–100 兜底（无配置/组件预览/旧测试仍可工作）。
 * 注意：这是「视觉比例」，与显示数值（真实工程值）解耦。
 */
export function fillPct(state: NodeState, field: string): number {
  const f = state.fractions?.[field];
  return clampPct(f !== undefined ? f : state.values[field]);
}

/**
 * 液面图元（各容器图元共用：tank/drum/vessel/column…）：活数据→顶边正弦轻微波动（wave，编码「数据
 * 新鲜·在动」）；失联(stale)→静态平面冻结（rect）。调用方仍需用 clip 裁进壳体轮廓。
 * rect = { x, y=液面顶, w, h=液柱高 }。
 */
export function liquidSurface(
  rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  stale: boolean,
  fill: string,
): Primitive {
  return stale
    ? { kind: "rect", x: rect.x, y: rect.y, w: rect.w, h: rect.h, style: { fill } }
    : { kind: "wave", x: rect.x, y: rect.y, w: rect.w, h: rect.h, amp: 1.6, wavelength: rect.w, period: 2600, style: { fill } };
}
