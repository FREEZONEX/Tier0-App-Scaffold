import { toWorld, type Viewport } from "./viewport";

export interface HitBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 图元旋转角（度）：判定时把查询点反旋到局部系，使旋转矩形命中准确。 */
  readonly rotation?: number;
  /** 圆形精确命中：存在时按 (cx,cy,r) 圆判定，而非矩形 bbox（避免点角落误选）。 */
  readonly circle?: { readonly cx: number; readonly cy: number; readonly r: number };
  /** 图元视觉锚点（= node.x/y）：连线端口跨轴对齐用（拖线预览与 auto 边重算共享同一基准）。 */
  readonly cx?: number;
  readonly cy?: number;
  /** 只用左右连接点（泵/阀）：连接点显示与落点判定只取 L/R，不显示顶/底口。 */
  readonly lrOnly?: boolean;
}

function contains(box: HitBox, x: number, y: number): boolean {
  // 旋转矩形：把查询点绕中心反旋 rotation 度回到局部系再做轴对齐判定（圆形旋转不变，跳过）
  if (box.rotation && !box.circle) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const a = (-box.rotation * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    x = cx + dx * Math.cos(a) - dy * Math.sin(a);
    y = cy + dx * Math.sin(a) + dy * Math.cos(a);
  }
  if (box.circle) {
    const dx = x - box.circle.cx;
    const dy = y - box.circle.cy;
    return dx * dx + dy * dy <= box.circle.r * box.circle.r;
  }
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

/** 屏幕坐标 → 命中的 nodeId（顶层优先），无命中返回 null。 */
export function hitTest(
  boxes: readonly HitBox[],
  vp: Viewport,
  screenX: number,
  screenY: number,
): string | null {
  const { x, y } = toWorld(vp, screenX, screenY);
  for (let i = boxes.length - 1; i >= 0; i--) {
    if (contains(boxes[i], x, y)) {
      return boxes[i].id;
    }
  }
  return null;
}

// ───────────── 连线命中（点击选中边 → Del 删除） ─────────────

export interface EdgePath {
  readonly id: string;
  /** 该边当前实际渲染折线（auto 边为每帧重算结果，非存储快照）。 */
  readonly points: readonly (readonly [number, number])[];
}

/** 点到线段最短距离。 */
function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ───────────── 框选命中连线 ─────────────

/** 判断线段 (ax,ay)→(bx,by) 是否与轴对齐矩形 [rx0,ry0]×[rx1,ry1] 相交（含端点在矩形内的情况）。 */
function segIntersectsRect(
  ax: number, ay: number, bx: number, by: number,
  rx0: number, ry0: number, rx1: number, ry1: number,
): boolean {
  // 端点在矩形内即命中
  const inRect = (x: number, y: number) => x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1;
  if (inRect(ax, ay) || inRect(bx, by)) return true;
  // Cohen-Sutherland 裁剪：用参数化 t 检查线段是否穿过矩形
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0, tMax = 1;
  const clip = (num: number, den: number) => {
    if (den === 0) return num <= 0; // 平行边：仅当在边界内侧才继续
    const t = num / den;
    if (den < 0) { if (t > tMin) tMin = t; } else { if (t < tMax) tMax = t; }
    return tMin <= tMax;
  };
  return (
    clip(ax - rx0, -dx) &&
    clip(rx1 - ax, dx) &&
    clip(ay - ry0, -dy) &&
    clip(ry1 - ay, dy) &&
    tMin <= tMax
  );
}

/**
 * 框选命中连线：把两屏幕角点反算到世界系，返回折线任一段（或任一端点）与世界矩形相交的边 id 列表。
 */
export function edgesInMarquee(
  paths: readonly EdgePath[],
  vp: Viewport,
  sx0: number, sy0: number,
  sx1: number, sy1: number,
): string[] {
  const a = toWorld(vp, sx0, sy0);
  const b = toWorld(vp, sx1, sy1);
  const rx0 = Math.min(a.x, b.x), rx1 = Math.max(a.x, b.x);
  const ry0 = Math.min(a.y, b.y), ry1 = Math.max(a.y, b.y);
  const ids: string[] = [];
  for (const path of paths) {
    const pts = path.points;
    if (pts.length === 0) continue;
    let hit = false;
    for (let i = 0; i < pts.length - 1 && !hit; i++) {
      hit = segIntersectsRect(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rx0, ry0, rx1, ry1);
    }
    // 单点退化边（长度 1）：仅端点命中
    if (!hit && pts.length === 1) {
      const [px, py] = pts[0];
      hit = px >= rx0 && px <= rx1 && py >= ry0 && py <= ry1;
    }
    if (hit) ids.push(path.id);
  }
  return ids;
}

// ───────────── 端点吸附几何辅助 ─────────────

/**
 * 点 P 到线段 AB 的最近点及距离（世界系）。
 * 返回最近点坐标与点到该点的欧氏距离。
 */
export function nearestPointOnSegment(
  ax: number, ay: number,
  bx: number, by: number,
  px: number, py: number,
): { x: number; y: number; dist: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { x, y, dist: Math.hypot(px - x, py - y) };
}

/**
 * 点 P 到折线（多个世界坐标点）的最近点及距离。
 * 遍历所有线段取最近值。
 */
export function nearestPointOnPath(
  points: readonly (readonly [number, number])[],
  px: number,
  py: number,
): { point: [number, number]; dist: number } {
  let bestDist = Infinity;
  let bestPoint: [number, number] = [px, py];
  for (let i = 0; i < points.length - 1; i++) {
    const r = nearestPointOnSegment(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], px, py);
    if (r.dist < bestDist) {
      bestDist = r.dist;
      bestPoint = [r.x, r.y];
    }
  }
  return { point: bestPoint, dist: bestDist };
}

/**
 * 跨所有 EdgePath 折线，找离 (px,py) 最近的点（世界系）。
 * 跳过 excludeId（拖拽中的边自身），仅返回距离 ≤ maxDist 的结果。
 * px,py,maxDist 均为世界单位（调用方按 SNAP_PX/vp.scale 换算后传入）。
 */
export function nearestEdgePoint(
  edgePaths: readonly EdgePath[],
  px: number,
  py: number,
  excludeId: string,
  maxDist: number,
): { edgeId: string; point: [number, number]; dist: number } | null {
  let best: { edgeId: string; point: [number, number]; dist: number } | null = null;
  for (const path of edgePaths) {
    if (path.id === excludeId) continue;
    if (path.points.length < 2) continue;
    const r = nearestPointOnPath(path.points, px, py);
    if (r.dist <= maxDist && (best === null || r.dist < best.dist)) {
      best = { edgeId: path.id, point: r.point, dist: r.dist };
    }
  }
  return best;
}

// ───────────────────────────────────────────────

/**
 * 屏幕坐标命中连线：折线任一段距离 ≤ tolPx（屏幕像素，按缩放换算到世界系）即命中。
 * 后绘制（数组后部）优先。无命中 null。
 */
export function hitTestEdges(
  paths: readonly EdgePath[],
  vp: Viewport,
  screenX: number,
  screenY: number,
  tolPx = 6,
): string | null {
  const { x, y } = toWorld(vp, screenX, screenY);
  const tol = tolPx / vp.scale;
  for (let i = paths.length - 1; i >= 0; i--) {
    const pts = paths[i].points;
    for (let j = 0; j < pts.length - 1; j++) {
      if (segDist(x, y, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1]) <= tol) return paths[i].id;
    }
  }
  return null;
}
