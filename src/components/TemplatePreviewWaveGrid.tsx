import { useEffect, useRef } from "react";

/**
 * Pre-generation placeholder artwork: a large "T0" wordmark built from a grid
 * of small monospace "T"/"0" glyphs.
 *
 * Cells are only drawn where they fall inside the wordmark silhouette. Glyph
 * colour drifts between the tertiary text grey and the Tier0 highlight green;
 * brightness is a pure function of (column, row, time): a slow diagonal
 * travelling wave plus a whole-screen breathing envelope. No pointer tracking,
 * no random light sources — deterministic apart from the glyph flips.
 *
 * Kept translucent on purpose: the platform preview shows this page under a
 * blurred, 70–95% opaque wait mask with its own copy in the centre. Small
 * low-alpha glyphs blur into a faint tint rather than a solid shape, unlike a
 * dark logo would.
 */

const CELL = 20;
const FONT_SIZE = 10;
const GLYPHS = "T0";
const FLIP_INTERVAL_MS = 120;
const FLIP_CHANCE = 0.15;

// Brightness: alpha = ALPHA_BASE + t * ALPHA_RANGE, t in [0, 1].
const ALPHA_BASE = 0.18;
const ALPHA_RANGE = 0.62;
// Colour: grey -> highlight interpolation is capped so peaks are greenish grey.
const COLOR_MIX_MAX = 0.85;

// Diagonal travelling wave in cell units. Wavelength ~40 cells.
const WAVE_KX = 0.12;
const WAVE_KY = 0.08;
const WAVE_PERIOD_S = 7;
// Per-cell slow twinkle with a stable phase from a hash of (c, r).
const TWINKLE_PERIOD_S = 5;
const TWINKLE_WEIGHT = 0.3;
// Whole-screen envelope. Kept off the platform mask's 4.5s so they don't beat.
const BREATH_PERIOD_S = 6;
const BREATH_MIN = 0.5;

// Wordmark silhouette: rendered offscreen and sampled at cell centres.
const WORDMARK = "T0";
const WORDMARK_WIDTH_RATIO = 0.7; // of the shorter of (width, height*1.6)

function resolveWordmarkFont(px: number) {
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-app-sans").trim() ||
    "system-ui, sans-serif";
  return `700 ${px}px ${family}`;
}

/** Bit per cell: 1 when the cell centre lies inside the wordmark. */
function buildWordmarkMask(width: number, height: number, cols: number, rows: number) {
  const mask = new Uint8Array(cols * rows);
  const off = document.createElement("canvas");
  off.width = Math.max(1, width);
  off.height = Math.max(1, height);
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return mask;

  const targetWidth = Math.min(width, height * 1.6) * WORDMARK_WIDTH_RATIO;
  // Fit the text width to targetWidth by measuring at a reference size.
  octx.font = resolveWordmarkFont(100);
  const refWidth = octx.measureText(WORDMARK).width || 1;
  const px = (100 * targetWidth) / refWidth;
  octx.font = resolveWordmarkFont(px);
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  octx.fillStyle = "#000";
  octx.fillText(WORDMARK, width / 2, height / 2);

  const data = octx.getImageData(0, 0, off.width, off.height).data;
  for (let r = 0; r < rows; r++) {
    const y = Math.min(off.height - 1, Math.floor(r * CELL + CELL / 2));
    for (let c = 0; c < cols; c++) {
      const x = Math.min(off.width - 1, Math.floor(c * CELL + CELL / 2));
      mask[r * cols + c] = data[(y * off.width + x) * 4 + 3] > 96 ? 1 : 0;
    }
  }
  return mask;
}

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

export function TemplatePreviewWaveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grey = readRgb("--tier0-text-tertiary", [135, 135, 135]);
    const green = readRgb("--tier0-highlight", [178, 237, 29]);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let glyphs: Uint8Array = new Uint8Array(0);
    let phases: Float32Array = new Float32Array(0);
    let mask: Uint8Array = new Uint8Array(0);
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
      mask = buildWordmarkMask(width, height, cols, rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          glyphs[i] = Math.random() < 0.5 ? 0 : 1;
          phases[i] = cellHash(c, r) * Math.PI * 2;
        }
      }
    };

    const draw = (now: number) => {
      const time = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      const breath =
        BREATH_MIN + (1 - BREATH_MIN) * (0.5 + 0.5 * Math.sin((time / BREATH_PERIOD_S) * Math.PI * 2));
      const wavePhase = (time / WAVE_PERIOD_S) * Math.PI * 2;
      const twinklePhase = (time / TWINKLE_PERIOD_S) * Math.PI * 2;

      for (let r = 0; r < rows; r++) {
        const y = r * CELL + CELL / 2;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (!mask[i]) continue;
          const x = c * CELL + CELL / 2;

          const wave = Math.sin(WAVE_KX * c + WAVE_KY * r - wavePhase);
          const twinkle = Math.sin(twinklePhase + phases[i]) * TWINKLE_WEIGHT;
          let t = 0.5 + 0.5 * (wave + twinkle) / (1 + TWINKLE_WEIGHT);
          t *= breath;

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
