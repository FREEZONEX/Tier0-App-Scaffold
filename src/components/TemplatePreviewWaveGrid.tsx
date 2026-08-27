import { useEffect, useRef, type RefObject } from "react";

import {
  ASCII_HALO_CHARS,
  ASCII_RAMP,
  fieldFor,
  LOGO_T_PATH,
  LOGO_TILE_SIZE,
  LOGO_ZERO_PATH,
  WORDMARK_TEXT,
  type CoverSettings,
  type FieldInput,
} from "@/components/template-preview-covers";

/**
 * Glyph-grid canvas for the pre-generation placeholder.
 *
 * A full-screen grid of monospace "T"/"0" glyphs whose colour drifts between
 * the tertiary text grey and the Tier0 highlight green. Per-cell brightness
 * comes from the active cover variant's field function — a pure function of
 * (cell, time, settings) — so the animation is deterministic and stateless
 * apart from the random glyph flips. No pointer tracking.
 *
 * Settings are read from a ref every frame so the dat.gui panel can tune them
 * live; anything that changes the grid layout (cell pitch, density, logo
 * silhouette) triggers a rebuild on the next frame.
 */

const GLYPHS = "T0";

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

function wordmarkFont(px: number) {
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-app-sans").trim() ||
    "system-ui, sans-serif";
  return `700 ${px}px ${family}`;
}

/**
 * Per-cell 0..1 weight of a centred silhouette, feathered at the edges.
 * "logo" fills the builder logo glyph paths; "wordmark" fills a large "T0".
 */
type ShapeKind = "logo" | "wordmark" | "ascii-tile" | "ascii-t" | "ascii-zero" | "ascii-halo";

function buildShapeMask(
  kind: ShapeKind,
  width: number,
  height: number,
  cols: number,
  rows: number,
  cell: number,
  s: CoverSettings,
  taps = 5,
) {
  const mask = new Float32Array(cols * rows);
  const off = document.createElement("canvas");
  off.width = Math.max(1, width);
  off.height = Math.max(1, height);
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return mask;

  octx.fillStyle = "#000";
  if (kind.startsWith("ascii")) {
    const size = Math.min(width, height) * s.asciiSize;
    const scale = size / LOGO_TILE_SIZE;
    octx.setTransform(scale, 0, 0, scale, (width - size) / 2, (height - size) / 2);
    const tile = new Path2D();
    tile.roundRect(0, 0, LOGO_TILE_SIZE, LOGO_TILE_SIZE, 5);
    if (kind === "ascii-tile") octx.fill(tile);
    if (kind === "ascii-t") octx.fill(new Path2D(LOGO_T_PATH));
    if (kind === "ascii-zero") octx.fill(new Path2D(LOGO_ZERO_PATH), "evenodd");
    if (kind === "ascii-halo") {
      octx.lineWidth = (2 * s.asciiHalo * cell) / scale;
      octx.strokeStyle = "#000";
      octx.stroke(tile);
      octx.fill(tile);
    }
    octx.setTransform(1, 0, 0, 1, 0, 0);
  } else if (kind === "logo") {
    const size = Math.min(width, height) * s.logoSize;
    const scale = size / LOGO_TILE_SIZE;
    octx.setTransform(scale, 0, 0, scale, (width - size) / 2, (height - size) / 2);
    octx.fill(new Path2D(LOGO_T_PATH));
    octx.fill(new Path2D(LOGO_ZERO_PATH), "evenodd");
    octx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    const targetWidth = Math.min(width, height * 1.6) * s.wordmarkSize;
    octx.font = wordmarkFont(100);
    const refWidth = octx.measureText(WORDMARK_TEXT).width || 1;
    octx.font = wordmarkFont((100 * targetWidth) / refWidth);
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText(WORDMARK_TEXT, width / 2, height / 2);
  }

  const data = octx.getImageData(0, 0, off.width, off.height).data;
  const sample = (x: number, y: number) => {
    const xi = Math.min(off.width - 1, Math.max(0, Math.floor(x)));
    const yi = Math.min(off.height - 1, Math.max(0, Math.floor(y)));
    return data[(yi * off.width + xi) * 4 + 3] / 255;
  };
  const q = kind.startsWith("ascii") ? cell / 3 : (cell * s.logoFeather) / 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cell + cell / 2;
      const y = r * cell + cell / 2;
      if (q <= 0) {
        mask[r * cols + c] = sample(x, y);
      } else if (taps === 9) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) sum += sample(x + dx * q, y + dy * q);
        mask[r * cols + c] = sum / 9;
      } else {
        mask[r * cols + c] =
          (sample(x, y) +
            sample(x - q, y - q) +
            sample(x + q, y - q) +
            sample(x - q, y + q) +
            sample(x + q, y + q)) /
          5;
      }
    }
  }
  return mask;
}

export function TemplatePreviewWaveGrid({
  settingsRef,
}: {
  settingsRef: RefObject<CoverSettings>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grey = readRgb("--tier0-text-tertiary", [135, 135, 135]);
    const green = readRgb("--tier0-highlight", [178, 237, 29]);
    const ink = readRgb("--tier0-text-color", [5, 11, 20]);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let glyphs: Uint8Array = new Uint8Array(0);
    let phases: Float32Array = new Float32Array(0);
    let visible: Uint8Array = new Uint8Array(0);
    let logoMask: Float32Array = new Float32Array(0);
    // ASCII variant region coverages
    let asciiTile: Float32Array = new Float32Array(0);
    let asciiT: Float32Array = new Float32Array(0);
    let asciiZero: Float32Array = new Float32Array(0);
    let asciiHalo: Float32Array = new Float32Array(0);
    let layoutKey = "";
    let frame = 0;
    let lastFlip = 0;
    const start = performance.now();

    const layoutKeyFor = (s: CoverSettings) =>
      [
        width,
        height,
        s.cell,
        s.density,
        s.variant,
        s.logoSize,
        s.logoFeather,
        s.wordmarkSize,
        s.wordmarkThreshold,
        s.asciiSize,
        s.asciiHalo,
      ].join("|");

    const rebuild = (s: CoverSettings) => {
      const cell = s.cell;
      cols = Math.ceil(width / cell) + 1;
      rows = Math.ceil(height / cell) + 1;
      glyphs = new Uint8Array(cols * rows);
      phases = new Float32Array(cols * rows);
      visible = new Uint8Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const h = cellHash(c, r);
          glyphs[i] = Math.random() < 0.5 ? 0 : 1;
          phases[i] = h * Math.PI * 2;
          visible[i] = h < s.density ? 1 : 0;
        }
      }
      logoMask =
        s.variant === "emboss"
          ? buildShapeMask("logo", width, height, cols, rows, cell, s)
          : new Float32Array(cols * rows);
      if (s.variant === "wordmark") {
        const shape = buildShapeMask("wordmark", width, height, cols, rows, cell, s);
        for (let i = 0; i < visible.length; i++) {
          if (shape[i] < s.wordmarkThreshold) visible[i] = 0;
        }
      }
      if (s.variant === "ascii") {
        asciiTile = buildShapeMask("ascii-tile", width, height, cols, rows, cell, s, 9);
        asciiT = buildShapeMask("ascii-t", width, height, cols, rows, cell, s, 9);
        asciiZero = buildShapeMask("ascii-zero", width, height, cols, rows, cell, s, 9);
        asciiHalo = buildShapeMask("ascii-halo", width, height, cols, rows, cell, s, 9);
      }
      layoutKey = layoutKeyFor(s);
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutKey = "";
    };

    const input: FieldInput = { c: 0, r: 0, time: 0, phase: 0, logo: 0 };

    const rgba = (col: [number, number, number], a: number) =>
      `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;

    /** Ghostty-style density art: character chosen by region coverage. */
    const drawAscii = (s: CoverSettings, time: number) => {
      const cell = s.cell;
      const last = ASCII_RAMP.length - 1;
      const shimmerPhase = s.asciiShimmerPeriod > 0 ? (time / s.asciiShimmerPeriod) * Math.PI * 2 : 0;
      const breathe = s.breathPeriod > 0
        ? s.breathMin + (1 - s.breathMin) * (0.5 + 0.5 * Math.sin((time / s.breathPeriod) * Math.PI * 2))
        : 1;

      for (let r = 0; r < rows; r++) {
        const y = r * cell + cell / 2;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x = c * cell + cell / 2;
          const jitter = s.asciiShimmer * 0.5 * Math.sin(shimmerPhase + phases[i] * 3);

          const zc = asciiZero[i];
          const tc = asciiT[i];
          const tileC = asciiTile[i];
          const haloC = asciiHalo[i];

          let ch = "";
          let color: [number, number, number] = grey;
          let alpha = 0;

          if (zc > 0.08) {
            const d = Math.min(1, Math.max(0, zc + jitter * 0.4));
            ch = ASCII_RAMP[Math.round(d * last)];
            color = green;
            alpha = s.asciiGlyphAlpha;
          } else if (tc > 0.08) {
            const d = Math.min(1, Math.max(0, tc + jitter * 0.4));
            ch = ASCII_RAMP[Math.round(d * last)];
            color = ink;
            alpha = s.asciiGlyphAlpha;
          } else if (s.asciiTile && tileC > 0.08) {
            // light texture inside the tile: low ramp levels only
            const d = Math.min(1, Math.max(0, tileC * 0.35 + jitter * 0.2));
            ch = ASCII_RAMP[Math.max(1, Math.round(d * last))];
            color = grey;
            alpha = s.asciiTileAlpha;
          } else if (s.asciiHalo > 0 && haloC > 0.08 && tileC < 0.5) {
            // halo ring: sparse green chars, fading outwards, gently cycling
            const k = Math.floor(
              ((Math.sin(shimmerPhase * 0.5 + phases[i]) + 1) / 2) * (ASCII_HALO_CHARS.length - 1) + 0.5,
            );
            ch = ASCII_HALO_CHARS[k];
            color = green;
            alpha = s.asciiHaloAlpha * Math.min(1, haloC * 1.2) * breathe;
          }
          if (!ch || ch === " " || alpha <= 0.005) continue;
          ctx.fillStyle = rgba(color, alpha);
          ctx.fillText(ch, x, y);
        }
      }
    };

    const draw = (now: number) => {
      const s = settingsRef.current;
      if (layoutKey !== layoutKeyFor(s)) rebuild(s);
      const field = fieldFor(s.variant);
      const cell = s.cell;

      input.time = ((now - start) / 1000) * s.speed;
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${s.fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      if (s.variant === "ascii") {
        drawAscii(s, input.time);
        return;
      }

      for (let r = 0; r < rows; r++) {
        const y = r * cell + cell / 2;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (!visible[i]) continue;
          const x = c * cell + cell / 2;
          input.c = c;
          input.r = r;
          input.phase = phases[i];
          input.logo = logoMask[i];

          const t = Math.min(1, Math.max(0, field(input, s)));
          const mix = t * s.colorMix;
          const R = Math.round(grey[0] + (green[0] - grey[0]) * mix);
          const G = Math.round(grey[1] + (green[1] - grey[1]) * mix);
          const B = Math.round(grey[2] + (green[2] - grey[2]) * mix);
          ctx.fillStyle = `rgba(${R},${G},${B},${(s.alphaBase + t * s.alphaRange).toFixed(3)})`;
          ctx.fillText(GLYPHS[glyphs[i]], x, y);
        }
      }
    };

    const loop = (now: number) => {
      const s = settingsRef.current;
      if (now - lastFlip >= s.flipInterval) {
        lastFlip = now;
        for (let i = 0; i < glyphs.length; i++) {
          if (Math.random() < s.flipChance) glyphs[i] = Math.random() < 0.5 ? 0 : 1;
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
  }, [settingsRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
