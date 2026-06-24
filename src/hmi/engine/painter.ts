import type { Primitive, Style } from "./primitives";

const FLOW_DASH: number[] = [9, 9];
const FLOW_PERIOD = 1000; // 流向动画周期 ms
const FLOW_SPEED = 18; // 每个流向周期移动的像素（= 一个完整 dash 周期）
const BLINK_PERIOD = 1100; // 报警慢闪周期 ms（spec §3 ~1.1s，与流向解耦）

function applyStroke(ctx: CanvasRenderingContext2D, style: Style): boolean {
  if (!style.stroke) return false;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.strokeWidth ?? 1;
  ctx.lineCap = style.lineCap ?? "butt";
  ctx.setLineDash(style.dash ? [...style.dash] : []);
  return true;
}

function applyFill(ctx: CanvasRenderingContext2D, style: Style): boolean {
  if (!style.fill) return false;
  ctx.fillStyle = style.fill;
  return true;
}

/** blink: 按 BLINK_PERIOD 周期，透明度在 1↔0.3 间正弦摆动。 */
function alpha(style: Style, timeMs: number): number {
  const base = style.opacity ?? 1;
  if (!style.blink) return base;
  const phase = (timeMs % BLINK_PERIOD) / BLINK_PERIOD;
  const wave = 0.65 + 0.35 * Math.cos(phase * Math.PI * 2);
  return base * wave;
}

function tracePoints(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], close: boolean): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
}

function paintOne(ctx: CanvasRenderingContext2D, p: Primitive, timeMs: number, flowOffset: number): void {
  if (p.kind === "clip") {
    ctx.save();
    ctx.beginPath();
    if (p.r) ctx.roundRect(p.x, p.y, p.w, p.h, p.r);
    else ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();
    for (const child of p.children) paintOne(ctx, child, timeMs, flowOffset);
    ctx.restore();
    return;
  }
  if (p.kind === "rotate") {
    // spinPeriod 给定则叠加 timeMs 相位 → 运行态持续自转；否则静态朝向。
    const deg = p.spinPeriod ? p.deg + ((timeMs % p.spinPeriod) / p.spinPeriod) * 360 : p.deg;
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.translate(-p.cx, -p.cy);
    for (const child of p.children) paintOne(ctx, child, timeMs, flowOffset);
    ctx.restore();
    return;
  }
  if (p.kind === "scale") {
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.scale(p.sx, p.sy);
    ctx.translate(-p.cx, -p.cy);
    for (const child of p.children) paintOne(ctx, child, timeMs, flowOffset);
    ctx.restore();
    return;
  }
  {
    ctx.globalAlpha = alpha(p.style, timeMs);
    switch (p.kind) {
      case "rect": {
        ctx.beginPath();
        if (p.r) ctx.roundRect(p.x, p.y, p.w, p.h, p.r);
        else ctx.rect(p.x, p.y, p.w, p.h);
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "circle": {
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "polygon": {
        tracePoints(ctx, p.points, true);
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "path": {
        ctx.beginPath();
        for (const cmd of p.d) {
          if (cmd.c === "M") ctx.moveTo(cmd.x, cmd.y);
          else if (cmd.c === "L") ctx.lineTo(cmd.x, cmd.y);
          else if (cmd.c === "Q") ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
          else if (cmd.c === "C") ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
          else ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw ?? false);
        }
        if (p.close) ctx.closePath();
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "polyline":
      case "line": {
        if (p.kind === "line") tracePoints(ctx, [[p.x1, p.y1], [p.x2, p.y2]], false);
        else tracePoints(ctx, p.points, false);
        applyStroke(ctx, p.style);
        ctx.stroke();
        if (p.flow) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.setLineDash(FLOW_DASH);
          ctx.lineDashOffset = flowOffset;
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "wave": {
        // 顶边正弦起伏 → 向下填到 y+h。相位随 timeMs 推进（period>0），液面缓缓晃动。
        const phase = p.period > 0 ? ((timeMs % p.period) / p.period) * Math.PI * 2 : 0;
        const k = (Math.PI * 2) / p.wavelength;
        const surf = (sx: number): number => p.y + p.amp * Math.sin(k * (sx - p.x) + phase);
        const step = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, surf(p.x));
        for (let sx = p.x + step; sx < p.x + p.w; sx += step) ctx.lineTo(sx, surf(sx));
        ctx.lineTo(p.x + p.w, surf(p.x + p.w));
        ctx.lineTo(p.x + p.w, p.y + p.h);
        ctx.lineTo(p.x, p.y + p.h);
        ctx.closePath();
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
      case "text": {
        // 自包含：font/textAlign 改动不泄漏到后续 primitive（尤其 clip 组外）
        ctx.save();
        if (p.style.font) ctx.font = p.style.font;
        ctx.textAlign = p.style.textAlign ?? "left";
        if (p.style.halo) {
          // 衬底反白：底色粗描边在填充之下，文字压住穿行的管线
          ctx.strokeStyle = p.style.halo;
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(p.text, p.x, p.y);
        }
        applyFill(ctx, p.style);
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
        break;
      }
    }
  }
}

/** timeMs: 自渲染开始的经过毫秒，blink/flow 各自按周期取相位（互不耦合）。 */
export function paint(ctx: CanvasRenderingContext2D, primitives: readonly Primitive[], timeMs: number): void {
  const flowOffset = -((timeMs % FLOW_PERIOD) / FLOW_PERIOD) * FLOW_SPEED;
  for (const p of primitives) paintOne(ctx, p, timeMs, flowOffset);
  ctx.globalAlpha = 1;
}
