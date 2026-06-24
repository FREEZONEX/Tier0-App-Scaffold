/**
 * 连线自动走线：连接点（拖线交互锚点）+ 中心制正交布线。
 * HmiCanvas（拖拽预览/端口显示）与 scene-render（auto 边每帧重算）共用，
 * 保证「画的时候看到的」与「移动后重算的」是同一套几何。
 *
 * 贴紧原理：线几何走「中心 → 中心」，两端深入图元内部，被不透明背板
 * （见 scene-render）盖住 —— 可见端永远齐着图元可见边界，不论圆形/内缩
 * 轮廓都零缝隙。bbox 边中点的连接点只作拖线起手的视觉锚，不进最终几何。
 */

export interface RouteBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 图元视觉锚点（= node.x/y，主体绘制中心）。给定则端口跨轴对齐到锚点而非 bbox 中心
   *  —— bounds 含标签/管嘴/侧桩的非对称留白时，bbox 中心偏离视觉正中，会让连线接口跑偏。
   *  缺省回落 bbox 中心（圆形/对称图元两者一致）。 */
  readonly cx?: number;
  readonly cy?: number;
}

/** 跨轴对齐基准：锚点优先，回落 bbox 中心。 */
const ax = (b: RouteBox): number => b.cx ?? b.x + b.w / 2;
const ay = (b: RouteBox): number => b.cy ?? b.y + b.h / 2;

export interface Port {
  readonly x: number;
  readonly y: number;
  /** true=从该口水平出线（左右口），false=垂直（上下口）。 */
  readonly h: boolean;
}

/** 图元四向连接点（世界系）：左、右、上、下边中点（跨轴对齐到视觉锚点）。拖线交互的视觉锚。 */
export function portsOf(box: RouteBox): Port[] {
  return [
    { x: box.x, y: ay(box), h: true },
    { x: box.x + box.w, y: ay(box), h: true },
    { x: ax(box), y: box.y, h: false },
    { x: ax(box), y: box.y + box.h, h: false },
  ];
}

/** 离参考点最近的连接点（拖线起手吸附/目标高亮用）。 */
export function nearestPort(box: RouteBox, p: { x: number; y: number }): Port {
  let best = portsOf(box)[0];
  let bd = Infinity;
  for (const q of portsOf(box)) {
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

const center = (b: RouteBox) => ({ x: ax(b), y: ay(b) });

/** 水平/垂直吸附阈值（世界 px）：两端在此范围内近共线 → 收成纯直线，消除强迫症最恨的小拐点。
 *  终点的垂直坐标对齐起点（偏移落在目标背板内藏住），所以画/拖时一进入该带就「啪」地变直。 */
export const ALIGN_SNAP = 12;

/** 两点正交 L 形：主轴优先（横距大先横后竖，反之先竖后横）；近水平/垂直时吸附成纯直线。 */
export function centerRoute(a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // 近水平：纵差在吸附带内 → 收成水平线（终点纵坐标对齐 a.y）
  if (Math.abs(dy) <= ALIGN_SNAP) return [[a.x, a.y], [b.x, a.y]];
  // 近垂直：横差在吸附带内 → 收成垂直线（终点横坐标对齐 a.x）
  if (Math.abs(dx) <= ALIGN_SNAP) return [[a.x, a.y], [a.x, b.y]];
  return Math.abs(dx) >= Math.abs(dy)
    ? [[a.x, a.y], [b.x, a.y], [b.x, b.y]]
    : [[a.x, a.y], [a.x, b.y], [b.x, b.y]];
}

/** 两图元间自动走线（中心制）。auto 边渲染时每帧调用 —— 图元移动后轨迹自动跟随。 */
export function autoRoute(from: RouteBox, to: RouteBox): [number, number][] {
  return centerRoute(center(from), center(to));
}

// ───────────── 端口方位走线（保留用户拖拽的出/入口） ─────────────

/** 端口方位：左/右/上/下。与 schema edge.fromSide/toSide 的枚举字面量一致。 */
export type Side = "L" | "R" | "T" | "B";

/** 指定方位的连接点（世界系，bounds 边中点）。 */
export function portOf(box: RouteBox, side: Side): Port {
  if (side === "L") return { x: box.x, y: ay(box), h: true };
  if (side === "R") return { x: box.x + box.w, y: ay(box), h: true };
  if (side === "T") return { x: ax(box), y: box.y, h: false };
  return { x: ax(box), y: box.y + box.h, h: false };
}

/** 点相对盒最近的边（拉线起手吸附口 → 方位；落点 → 入口方位）。 */
export function nearestSide(box: RouteBox, p: { x: number; y: number }): Side {
  const dl = Math.abs(p.x - box.x);
  const dr = Math.abs(p.x - (box.x + box.w));
  const dt = Math.abs(p.y - box.y);
  const db = Math.abs(p.y - (box.y + box.h));
  const m = Math.min(dl, dr, dt, db);
  return m === dl ? "L" : m === dr ? "R" : m === dt ? "T" : "B";
}

/** 端点向图元内部缩进：被不透明背板盖住，可见端贴紧任意轮廓（与中心制同贴紧原理）。 */
const SIDE_INNER = 10;

/** 沿方位法向偏移（d>0 向外，d<0 向图元内部）。 */
function offsetBySide(p: { x: number; y: number }, side: Side, d: number): [number, number] {
  if (side === "L") return [p.x - d, p.y];
  if (side === "R") return [p.x + d, p.y];
  if (side === "T") return [p.x, p.y - d];
  return [p.x, p.y + d];
}

/** 去除相邻重复点（拼接段退化时）。 */
function dedupe(pts: [number, number][]): [number, number][] {
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}

/**
 * 带端口方位的正交走线（连线铁律实现）。两端都未指定 = 中心制 autoRoute。
 * 指定方位的一端从该**固定边中点**出/入（端点向图元内缩 SIDE_INNER 被背板盖住、可见端贴轮廓）；
 * **端口位置绝不随对端移动而变**——这是「从点拉出的线，点不动」的根基（实线/引线一律如此，仅自由点端例外）。
 * 中段最少折：竖直口×水平口 → 单折 L（拐角=竖直端 x×水平端 y）；同竖直/同水平 → 中点 Z 两折；
 * 端口对齐（同 x 或同 y）→ 退化直线。图元移动时每帧重算，方位/点位恒定，只线形跟随。
 */
export function sideRoute(from: RouteBox, to: RouteBox, fromSide?: Side, toSide?: Side): [number, number][] {
  if (!fromSide && !toSide) return autoRoute(from, to);
  // **固定连接点（边中点）**：位置绝不随对端/移动而变。这是核心铁律——"从点拉出的线，线怎么折都行，但端点不许动"。
  // 引线(虚线)与实线**一律如此**；唯一可任意点的是从库里拖出的独立虚线（其两端为自由点 fromPoint/toPoint → 无 side → 走下方 center 分支）。
  const a = fromSide ? portOf(from, fromSide) : center(from);
  const b = toSide ? portOf(to, toSide) : center(to);
  const aIn: [number, number] = fromSide ? offsetBySide(a, fromSide, -SIDE_INNER) : [a.x, a.y];
  const bIn: [number, number] = toSide ? offsetBySide(b, toSide, -SIDE_INNER) : [b.x, b.y];
  // 最少折中段（去掉冗余 stub）：垂直×水平→单折 L；都竖直/都水平→中点 Z 两折；一端自由→居中折。
  const aVert = fromSide === "T" || fromSide === "B";
  const bVert = toSide === "T" || toSide === "B";
  let mid: [number, number][];
  if (fromSide && toSide && aVert !== bVert) {
    mid = [aVert ? [a.x, b.y] : [b.x, a.y]]; // 单折 L：拐角 = 竖直端 x 与水平端 y 的交点
  } else if (fromSide && toSide && aVert) {
    const my = (a.y + b.y) / 2; // 都竖直：中点 y 折 Z
    mid = [[a.x, my], [b.x, my]];
  } else if (fromSide && toSide) {
    const mx = (a.x + b.x) / 2; // 都水平：中点 x 折 Z
    mid = [[mx, a.y], [mx, b.y]];
  } else {
    mid = centerRoute({ x: a.x, y: a.y }, { x: b.x, y: b.y }).slice(1, -1); // 一端自由：居中折，去掉首尾(=a,b)
  }
  return dedupe([aIn, [a.x, a.y], ...mid, [b.x, b.y], bIn]);
}
