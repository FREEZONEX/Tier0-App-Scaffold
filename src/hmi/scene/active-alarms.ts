import type { MimicNode } from "../schema/schema";
import type { NodeState } from "./scene";

/** 单条活动告警（跨 scene 聚合，供全局告警汇总栏）。 */
export interface ActiveAlarm {
  readonly nodeId: string;
  /** 设备显示名（node.label 兜底 id）。 */
  readonly label: string;
  /** 越限的量：绑定字段 key 或 watch 标签。 */
  readonly field: string;
  readonly level: "warn" | "alarm";
  /** 可显示的当前值（绑定字段有；watch 不带原始值时省略）。 */
  readonly value?: string;
}

const LEVEL_RANK: Record<"warn" | "alarm", number> = { alarm: 0, warn: 1 };

const fmtValue = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : typeof v === "object" ? JSON.stringify(v) : String(v);

/**
 * 跨 scene 聚合所有越限项 → 活动告警列表（alarm 在 warn 前，再按设备名、量名稳定排序）。
 * 纯函数：来源是各节点 NodeState 的 `levels`（绑定字段）与 `watchLevels`（数据点，按 node.watches 下标对齐）。
 */
export function activeAlarms(
  nodes: readonly MimicNode[],
  getState: (nodeId: string) => NodeState,
): ActiveAlarm[] {
  const out: ActiveAlarm[] = [];
  for (const node of nodes) {
    const state = getState(node.id);
    const label = node.label ?? node.id;
    if (state.levels) {
      for (const [field, level] of Object.entries(state.levels)) {
        out.push({ nodeId: node.id, label, field, level, value: fmtValue(state.values[field]) });
      }
    }
    state.watchLevels?.forEach((level, i) => {
      if (!level) return;
      out.push({ nodeId: node.id, label, field: node.watches?.[i]?.label ?? `watch-${i}`, level });
    });
  }
  return out.sort(
    (a, b) =>
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      a.label.localeCompare(b.label) ||
      a.field.localeCompare(b.field),
  );
}
