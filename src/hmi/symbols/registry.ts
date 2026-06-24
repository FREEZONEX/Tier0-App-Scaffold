import type { MimicNode } from "../schema/schema";
import type { NodeState } from "../scene/scene";
import type { Primitive } from "../engine/primitives";
import type { Palette } from "../engine/theme";
import { logger } from "../logger";

export interface SymbolContext {
  readonly node: MimicNode;
  readonly state: NodeState;
  readonly theme: Palette;
  /** 当前 viewport 缩放（细节层 LOD 用：showDetail(scale)）。未传（组件预览/单测）视为 1:1。 */
  readonly scale?: number;
}

export interface SymbolDef {
  readonly type: string;
  /** 纯函数：产出该图元在当前状态下的图元 IR（世界坐标，锚点 = node.x/y）。 */
  build(ctx: SymbolContext): Primitive[];
  /** 命中包围盒（世界坐标）。 */
  bounds(node: MimicNode): { x: number; y: number; w: number; h: number };
  /** 默认内联字段（schema node.inline 可覆盖）。 */
  readonly inlineFields?: readonly string[];
  /** 圆形图元：命中按外接圆精确判定（圆心 = node.x/y，半径 = bounds 宽/2）。
   *  可给函数按 node 逐个判定（如 instrument 的 box 显示模式=非圆形）。 */
  readonly circular?: boolean | ((node: MimicNode) => boolean);
  /** 圆形图元的可见主体半径：不透明背板按此画，齐着壳体轮廓收口连线（零缝隙）。
   *  缺省回落 min(bounds.w, bounds.h)/2 —— 当 bounds 被喷口/底座等撑大、远超可见壳体时
   *  （如泵），显式给出真实壳体半径，避免背板溢出留下「线齐不到壳」的环形缝。命中圈不受影响。 */
  readonly coreRadius?: number;
  /** 非圆形图元的可见连接盒（世界坐标，未缩放）：连线收口按此贴齐**真实壳体**，排除 bounds/bodyBBox 里
   *  外凸的管嘴/底座（如精馏塔侧管嘴把 bbox 撑大 → 线收口到管嘴区、露出画布色缝）。缺省回落 bodyBBox；
   *  connectBox 会按 node.sizeX/sizeY 缩放它。背板用本体剪影、非管嘴处本就贴圆筒，故只需修收口盒。 */
  readonly coreBox?: (node: MimicNode) => { x: number; y: number; w: number; h: number };
  /** 标注/叠加层：渲染到最上层（盖在所有设备+装饰之上）且不画不透明背板——
   *  数值点等"贴在别的组件上做标记"的元件需要它，否则会被后画的设备背板盖住。 */
  readonly overlay?: boolean;
  /** 不随「未配置/失联」褪色虚化：工艺边界端子（terminal）等很少接 MQTT，未绑定属常态、
   *  虚化无意义反而碍眼。置真则始终实色实线渲染（仍可被选中环/联锁等其他装饰影响）。 */
  readonly noFade?: boolean;
  /** 只用左右连接点（泵/阀等管段串联件：流体一侧进、另一侧出，无顶/底口）。
   *  影响 auto 走线选边（强制 L/R）、连接点显示与落点判定。 */
  readonly lrOnly?: boolean;
}

export interface Registry {
  get(type: string): SymbolDef;
  /** 该 type 是否已注册（未注册时 get 返回占位图元）。 */
  has(type: string): boolean;
}

/** 未知 type 兜底：画一个虚线方框 + "?"，绝不让整图崩。 */
const fallback: SymbolDef = {
  type: "unknown",
  build: ({ node, theme }) => [
    { kind: "rect", x: node.x - 16, y: node.y - 16, w: 32, h: 32, r: 3, style: { stroke: theme.stale, strokeWidth: 1.5, dash: [3, 3] } },
    { kind: "text", x: node.x, y: node.y + 5, text: "?", style: { fill: theme.stale, font: "16px ui-sans-serif, system-ui", textAlign: "center" } },
  ],
  bounds: (node) => ({ x: node.x - 16, y: node.y - 16, w: 32, h: 32 }),
};

export function createRegistry(defs: readonly SymbolDef[]): Registry {
  const byType = new Map<string, SymbolDef>();
  for (const def of defs) byType.set(def.type, def);
  const warned = new Set<string>();
  return {
    get(type) {
      const def = byType.get(type);
      if (def) return def;
      if (!warned.has(type)) {
        warned.add(type); // 每个未知 type 只告警一次（避免逐帧刷屏）
        logger.warn(`未知图元 type "${type}"，使用占位渲染`);
      }
      return fallback;
    },
    has(type) {
      return byType.has(type);
    },
  };
}
