import { paint } from "./painter";
import type { Primitive } from "./primitives";
import type { Viewport } from "./viewport";

export interface CanvasStage {
  /** 用当前视口与经过时间(ms)重绘给定图元。 */
  draw(primitives: readonly Primitive[], vp: Viewport, timeMs: number): void;
  /** CSS 像素尺寸。 */
  size(): { w: number; h: number };
  destroy(): void;
}

/**
 * 绑定一个 <canvas>，处理 DPR 与尺寸自适应。绘制时按 DPR×视口 设置变换，
 * painter 在世界坐标下绘制。
 */
export function createCanvasStage(
  canvas: HTMLCanvasElement,
  onResize: () => void,
): CanvasStage {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  let dpr = window.devicePixelRatio || 1;
  let cssW = 0, cssH = 0;

  const applySize = () => {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  };
  applySize();

  const observer = new ResizeObserver(() => {
    applySize();
    onResize();
  });
  observer.observe(canvas);

  return {
    draw(primitives, vp, timeMs) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.setTransform(dpr * vp.scale, 0, 0, dpr * vp.scale, dpr * vp.x, dpr * vp.y);
      paint(ctx, primitives, timeMs);
    },
    size() {
      return { w: cssW, h: cssH };
    },
    destroy() {
      observer.disconnect();
    },
  };
}
