import { useEffect, useRef } from "react";

import {
  getCoverVariant,
  LOGO_T_PATH,
  LOGO_TILE_SIZE,
  LOGO_ZERO_PATH,
  type FieldInput,
} from "@/components/template-preview-covers";

/**
 * Glyph-grid canvas for the pre-generation placeholder.
 *
 * A full-screen grid of monospace "T"/"0" glyphs whose colour drifts between
 * the tertiary text grey and the Tier0 highlight green. Per-cell brightness
 * comes from the active cover variant's field function — a pure function of
 * (cell, time), so the animation is deterministic and stateless apart from
 * the random glyph flips. No pointer tracking.
 *
 * The platform preview shows this page underneath a blurred, 70–95% opaque
 * wait mask with its own copy in the centre. Small translucent glyphs blur
 * into an even tint under that mask, so nothing solid sits on this cover.
 */

const CELL = 30;
const FONT_SIZE = 12;
const GLYPHS = "T0";
const FLIP_INTERVAL_MS = 120;
const FLIP_CHANCE = 0.15;

// Brightness: alpha = ALPHA_BASE + t * ALPHA_RANGE, t in [0, 1].
const ALPHA_BASE = 0.05;
const ALPHA_RANGE = 0.7;
// Colour: grey -> highlight interpolation cap.
const COLOR_MIX_MAX = 0.95;

// Logo silhouette size (CSS px) for the embossed variant.
const LOGO_MASK_SIZE = (w: number, h: number) => Math.min(w, h) * 0.6;

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readRgb(name: string, fallback: [number, number, number]) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return hexToRgb(value) ?? fallback;
}

function cellHash(c: number, r: number) {
  let h = (c * 374761393 + r * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Per-cell 0..1 weight of the logo glyph paths, softened at the edges. */
function buildLogoMask(width: number, height: number, cols: number, rows: number) {
  const mask = new Float32Array(cols * rows);
  const off = document.createElement("canvas");
  off.width = Math.max(1, width);
  off.height = Math.max(1, height);
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return mask;

  const size = LOGO_MASK_SIZE(width, height);
  const scale = size / LOGO_TILE_SIZE;
  octx.setTransform(scale, 0, 0, scale, (width - size) / 2, (height - size) / 2);
  octx.fillStyle = "#000";
  octx.fill(new Path2D(LOGO_T_PATH));
  octx.fill(new Path2D(LOGO_ZERO_PATH), "evenodd");
  octx.setTransform(1, 0, 0, 1, 0, 0);

  const data = octx.getImageData(0, 0, off.width, off.height).data;
  const sample = (x: number, y: number) => {
    const xi = Math.min(off.width - 1, Math.max(0, Math.floor(x)));
    const yi = Math.min(off.height - 1, Math.max(0, Math.floor(y)));
    return data[(yi * off.width + xi) * 4 + 3] / 255;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      // 5-tap sample so cells straddling an edge get a partial weight.
      const q = CELL / 4;
      mask[r * cols + c] =
        (sample(x, y) +
          sample(x - q, y - q) +
          sample(x + q, y - q) +
          sample(x - q, y + q) +
          sample(x + q, y + q)) /
        5;
    }
  }
  return mask;
}

export function TemplatePreviewWaveGrid({ variantId }: { variantId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const variant = getCoverVariant(variantId);
    const grey = readRgb("--tier0-text-tertiary", [135, 135, 135]);
    const green = readRgb("--tier0-highlight", [178, 237, 29]);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let glyphs: Uint8Array = new Uint8Array(0);
    let phases: Float32Array = new Float32Array(0);
    let logoMask: Float32Array = new Float32Array(0);
    let frame = 0;
    let lastFlip = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      glyphs = new Uint8Array(cols * rows);
      phases = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          glyphs[i] = Math.random() < 0.5 ? 0 : 1;
          phases[i] = cellHash(c, r) * Math.PI * 2;
        }
      }
      logoMask = variant.usesLogoMask
        ? buildLogoMask(width, height, cols, rows)
        : new Float32Array(cols * rows);
    };

    const input: FieldInput = {
      c: 0,
      r: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      time: 0,
      phase: 0,
      logo: 0,
    };

    const draw = (now: number) => {
      input.time = (now - start) / 1000;
      input.width = width;
      input.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      for (let r = 0; r < rows; r++) {
        const y = r * CELL + CELL / 2;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x = c * CELL + CELL / 2;
          input.c = c;
          input.r = r;
          input.x = x;
          input.y = y;
          input.phase = phases[i];
          input.logo = logoMask[i];

          const t = Math.min(1, Math.max(0, variant.field(input)));
          const mix = t * COLOR_MIX_MAX;
          const R = Math.round(grey[0] + (green[0] - grey[0]) * mix);
          const G = Math.round(grey[1] + (green[1] - grey[1]) * mix);
          const B = Math.round(grey[2] + (green[2] - grey[2]) * mix);
          ctx.fillStyle = `rgba(${R},${G},${B},${(ALPHA_BASE + t * ALPHA_RANGE).toFixed(3)})`;
          ctx.fillText(GLYPHS[glyphs[i]], x, y);
        }
      }
    };

    const loop = (now: number) => {
      if (now - lastFlip >= FLIP_INTERVAL_MS) {
        lastFlip = now;
        for (let i = 0; i < glyphs.length; i++) {
          if (Math.random() < FLIP_CHANCE) glyphs[i] = Math.random() < 0.5 ? 0 : 1;
        }
      }
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    // The placeholder is display:none unless the blank route is mounted, so a
    // zero-sized canvas means "not visible": don't animate.
    const observer = new ResizeObserver(() => {
      stop();
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
      resize();
      if (reduceMotion) {
        draw(start);
        return;
      }
      frame = requestAnimationFrame(loop);
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      stop();
    };
  }, [variantId]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
