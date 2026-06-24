import type { NodeState } from "../scene/scene";
import type { InterlockEffectKind } from "../schema/schema";
import { toBool } from "../shared/coerce";

export type Ring = "none" | "selection" | "fault" | "warn";
export type Badge = "none" | "interlock" | "fault" | "stale";

export interface Decoration {
  readonly ring: Ring;
  readonly badge: Badge;
  readonly blink: boolean;
  readonly faded: boolean;
  readonly dashed: boolean;
  /** 联锁效果类型，驱动挂锁角标变体。 */
  readonly interlockKind?: InterlockEffectKind;
}

/**
 * 把节点状态映射为统一装饰编码。
 * 优先级：未配置 > 不可信(失联/未知) > 故障/高高报 > 高报(warn) > 选中；角标 故障 > 联锁。
 * 未配置（未绑定任何数据点/未接入 MQTT）虚化（褪色、实线、无角标），提示「待接线」。
 * 数据不可信（stale 无数据 / quality unknown 映射未命中）统一作褪色虚线 + ? 角标。
 */
export function resolveDecoration(state: NodeState, selected: boolean, locked = false): Decoration {
  if (state.unconfigured) {
    return { ring: selected ? "selection" : "none", badge: "none", blink: false, faded: true, dashed: false, interlockKind: undefined };
  }
  if (state.stale || state.quality === "unknown") {
    return { ring: selected ? "selection" : "none", badge: "stale", blink: false, faded: true, dashed: true, interlockKind: undefined };
  }
  // 联锁角标：locked 参数 或 显式绑定的 values.interlock（通用，默认不出现）
  const interlock = locked || toBool(state.values.interlock);
  // fault 已含「阈值高高报(alarm)」；warn = 阈值高/低报，琥珀环、稳定不闪
  const ring: Ring = state.fault ? "fault" : state.alarm === "warn" ? "warn" : selected ? "selection" : "none";
  const badge: Badge = state.fault ? "fault" : interlock ? "interlock" : "none";
  return { ring, badge, blink: state.fault, faded: false, dashed: false, interlockKind: undefined };
}
