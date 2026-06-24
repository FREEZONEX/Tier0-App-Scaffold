export interface Viewport {
  readonly scale: number;
  readonly x: number; // 屏幕平移 x
  readonly y: number;
}

export function createViewport(): Viewport {
  return { scale: 1, x: 0, y: 0 };
}

export function toScreen(vp: Viewport, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * vp.scale + vp.x, y: wy * vp.scale + vp.y };
}

export function toWorld(vp: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
}

/** 以屏幕点 (sx,sy) 为锚点缩放到 scale，锚点屏幕位置不变。 */
export function zoomAt(vp: Viewport, sx: number, sy: number, scale: number): Viewport {
  const world = toWorld(vp, sx, sy);
  return { scale, x: sx - world.x * scale, y: sy - world.y * scale };
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 12;

/** 钳制缩放到 [MIN_ZOOM, MAX_ZOOM]，防止缩到 0/负或无限放大。 */
export function clampScale(scale: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}

/** 平移视口（屏幕像素增量）。不可变。 */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, x: vp.x + dx, y: vp.y + dy };
}

const MIN_SCALE = 0.02; // scale 正下界：容器极小/未布局时不产生负 scale（镜像翻转）或 0

/** 适配：把世界包围盒缩放平移到画布内并居中。 */
export function fit(
  box: { x: number; y: number; w: number; h: number },
  view: { w: number; h: number },
  padding = 24,
  maxScale = Infinity,
): Viewport {
  if (box.w <= 0 || box.h <= 0) return createViewport();
  // 不超过 maxScale：稀疏图保持自然尺寸居中，而非被放大到撑满（避免图元显得过大）
  // 夹到 MIN_SCALE 正下界：容器宽/高小于 2×padding 时分子为负，否则整图翻转
  const scale = Math.max(MIN_SCALE, Math.min(maxScale, (view.w - padding * 2) / box.w, (view.h - padding * 2) / box.h));
  const x = (view.w - box.w * scale) / 2 - box.x * scale;
  const y = (view.h - box.h * scale) / 2 - box.y * scale;
  return { scale, x, y };
}
