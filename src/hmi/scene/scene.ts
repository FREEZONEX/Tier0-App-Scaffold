import type { Mimic, MimicNode, MimicEdge } from "../schema/schema";
import { resolveBinding } from "../data/binding";
import { resolveSignal, type SignalLevel } from "../data/resolve-signal";
import { toBool } from "../shared/coerce";

export interface Scene {
  readonly meta: Mimic["meta"];
  readonly nodes: readonly MimicNode[];
  readonly edges: readonly MimicEdge[];
  readonly byId: Readonly<Record<string, MimicNode>>;
  readonly selectedId: string | null;
}

export function buildScene(mimic: Mimic): Scene {
  const byId: Record<string, MimicNode> = {};
  for (const node of mimic.nodes) {
    byId[node.id] = node;
  }
  return {
    meta: mimic.meta,
    nodes: mimic.nodes,
    edges: mimic.edges,
    byId,
    selectedId: null,
  };
}

/** 不可变更新选中节点。 */
export function selectNode(scene: Scene, id: string | null): Scene {
  return { ...scene, selectedId: id };
}

export interface NodeState {
  readonly values: Readonly<Record<string, unknown>>;
  /** 视觉填充比例 0–100（来自 binding.scale 量程；无量程的字段省略）。罐体/仪表填充与角度用。 */
  readonly fractions?: Readonly<Record<string, number>>;
  /** 字段单位（来自 binding.unit，用户配置；不内置推断）。显示数值时追加。 */
  readonly units?: Readonly<Record<string, string>>;
  readonly running: boolean;
  readonly fault: boolean;
  readonly stale: boolean;
  /** 各绑定字段的告警等级（normal 的字段省略）：面板据此给越限值变色，定位告警源。 */
  readonly levels?: Readonly<Record<string, "warn" | "alarm">>;
  /** 各额外数据点（watch）的告警等级，按 node.watches 下标对齐（normal/未配阈值为 undefined）。 */
  readonly watchLevels?: ReadonlyArray<"warn" | "alarm" | undefined>;
  /** 各额外数据点（watch）的解析读数（标签+实时值+告警级），按 node.watches 顺序。
   *  供图元在本体上渲染（如精馏塔逐塔盘温度）——把「只在检视面板看」升级成「可贴身显示」。 */
  readonly watchReadouts?: ReadonlyArray<{ readonly label: string; readonly value: unknown; readonly unit?: string; readonly level?: "warn" | "alarm" }>;
  /** 阈值派生告警等级（normal 时省略）。 */
  readonly alarm?: "warn" | "alarm";
  /** 数据质量异常：unknown=配了 map 却没命中（good 时省略；无数据走 stale）。 */
  readonly quality?: "unknown";
  /** 未配置：有可绑定字段却一个都没绑（未接入 MQTT）。虚化提示待接线。由上层按契约判定注入。 */
  readonly unconfigured?: boolean;
}

const LEVEL_RANK = { normal: 0, warn: 1, alarm: 2 } as const;

/**
 * 把节点绑定解析为视觉状态。每个字段经 resolveSignal 做映射/缩放/判阈：
 * 值进 values，阈值告警取各字段最严，map 未命中→quality unknown。
 * 有 topics 但一个值都没取到视为失联(stale)。
 */
export function resolveNodeState(
  node: MimicNode,
  getPayload: (topic: string) => unknown,
): NodeState {
  const values: Record<string, unknown> = {};
  const fractions: Record<string, number> = {};
  const units: Record<string, string> = {};
  const levels: Record<string, "warn" | "alarm"> = {};
  let anyResolved = false;
  let worst: SignalLevel = "normal";
  let anyUnknown = false;
  for (const [key, binding] of Object.entries(node.bindings)) {
    const sig = resolveSignal(binding, resolveBinding(getPayload, binding));
    values[key] = sig.value;
    if (sig.fraction !== undefined) fractions[key] = sig.fraction;
    if (binding.unit) units[key] = binding.unit;
    if (sig.value !== undefined) anyResolved = true;
    if (sig.quality === "unknown") anyUnknown = true;
    if (sig.level !== "normal") levels[key] = sig.level;
    if (LEVEL_RANK[sig.level] > LEVEL_RANK[worst]) worst = sig.level;
  }
  // 额外数据点（watch）：解析实时值供贴身渲染；配了 alarms 的并入节点告警（圈闪），等级按下标记录供面板变色。
  const watchLevels: Array<"warn" | "alarm" | undefined> = [];
  const watchReadouts: Array<{ label: string; value: unknown; unit?: string; level?: "warn" | "alarm" }> = [];
  for (const w of node.watches ?? []) {
    const raw = resolveBinding(getPayload, { topic: w.topic, path: w.path });
    let level: "warn" | "alarm" | undefined;
    if (w.alarms) {
      const sig = resolveSignal({ topic: w.topic, path: w.path || "-", alarms: w.alarms }, raw);
      level = sig.level !== "normal" ? sig.level : undefined;
      if (LEVEL_RANK[sig.level] > LEVEL_RANK[worst]) worst = sig.level;
    }
    watchLevels.push(level);
    watchReadouts.push({ label: w.label, value: raw, ...(w.unit ? { unit: w.unit } : {}), ...(level ? { level } : {}) });
  }
  const stale = node.topics.length > 0 && !anyResolved;
  return {
    values,
    fractions,
    units,
    running: toBool(values.running),
    // 故障 = 数值越高高/低低限（绑定字段或 watch，纯阈值派生）。不再读单独绑定的 fault 布尔位。
    fault: worst === "alarm",
    stale,
    ...(Object.keys(levels).length > 0 ? { levels } : {}),
    ...(watchLevels.some((l) => l !== undefined) ? { watchLevels } : {}),
    ...(watchReadouts.length > 0 ? { watchReadouts } : {}),
    ...(worst !== "normal" ? { alarm: worst } : {}),
    ...(!stale && anyUnknown ? { quality: "unknown" as const } : {}),
  };
}
