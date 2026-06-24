import type { Palette } from "@/hmi/engine/theme";
import type { Registry } from "@/hmi/symbols/registry";
import type { Primitive } from "@/hmi/engine/primitives";
import type { NodeState } from "@/hmi/scene/scene";
import { buildScene } from "@/hmi/scene/scene";
import { renderScene } from "@/hmi/symbols/scene-render";
import type { Mimic, MimicNode } from "@/hmi/schema/schema";

export interface LegendEntryDef {
  readonly key: string;
  readonly label: string;
  readonly desc: string;
  readonly type: string;
  readonly state: NodeState;
}

const S = (over: Partial<NodeState> = {}): NodeState => ({ values: {}, running: false, fault: false, stale: false, ...over });

/**
 * 图例条目：只介绍图元的几个真实状态语言（用真实图元渲染，与画布一致）。
 * 活跃/非活跃是统一的深/浅填充，适用于所有开关量图元（泵运行、阀门开…），故只示一次。
 */
export const LEGEND_ENTRIES: readonly LegendEntryDef[] = [
  { key: "run", label: "活跃", desc: "运行 / 开 / 通（深填充·醒目）", type: "pump", state: S({ running: true }) },
  { key: "stop", label: "非活跃", desc: "停止 / 关 / 断（浅填充）", type: "pump", state: S() },
  { key: "fault", label: "故障", desc: "红环闪烁 + ! 角标（高高/低低报）", type: "pump", state: S({ fault: true }) },
  { key: "warn", label: "预警", desc: "琥珀环·不闪（高/低报）", type: "pump", state: S({ alarm: "warn" }) },
  { key: "unconfigured", label: "未配置", desc: "虚化·实线（未绑定任何数据点·待接线）", type: "pump", state: S({ unconfigured: true }) },
  { key: "stale", label: "失联", desc: "虚化·虚线 + ? 角标（已绑定但无数据 / 未连接 MQTT）", type: "pump", state: S({ stale: true }) },
];

export interface Swatch {
  readonly primitives: readonly Primitive[];
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

function miniNode(type: string, props?: Record<string, unknown>): MimicNode {
  return { id: "s", type, x: 0, y: 0, rotation: 0, label: "", topics: [], bindings: {}, inline: [], ...(props ? { props } : {}) };
}

/** 为单个条目生成可绘制图元 + 包围盒（复用 renderScene 单节点路径，保证与画布一致）。 */
export function buildSwatch(
  entry: { type: string; state: NodeState; props?: Record<string, unknown> },
  theme: Palette,
  registry: Registry,
): Swatch {
  const node = miniNode(entry.type, entry.props);
  const scene = buildScene({ meta: { name: "s", version: 1 }, nodes: [node], edges: [], interlocks: [] } as Mimic);
  const { primitives } = renderScene(scene, registry, () => entry.state, () => false, theme);
  const b = registry.get(entry.type).bounds(node);
  return { primitives, box: { x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 } };
}
