/**
 * Cover variants for the pre-generation placeholder. Each variant is a pure
 * brightness field t(c, r, x, y, time) in [0, 1] over the glyph grid, plus an
 * optional overlay drawn on top of the canvas. The active variant is picked
 * from `?cover=<id>` or localStorage so several can be compared in place.
 */

export const LOGO_TILE_SIZE = 42;
export const LOGO_T_PATH =
  "M11.028 29.0898V14.7378H6.13195V12.2898H18.708V14.7378H13.812V29.0898H11.028Z";
export const LOGO_ZERO_PATH =
  "M21.2388 26.8338V14.5458L23.4948 12.2898H31.9428L34.1988 14.5458V26.8338L31.9428 29.0898H23.4948L21.2388 26.8338ZM24.0228 14.7858V26.5938H31.4148V14.7858H24.0228Z";

export interface FieldInput {
  c: number;
  r: number;
  x: number;
  y: number;
  width: number;
  height: number;
  time: number;
  /** stable per-cell phase in [0, 2π) */
  phase: number;
  /** 0..1 weight of the logo silhouette at this cell (only for emboss) */
  logo: number;
}

export interface CoverVariant {
  id: string;
  label: string;
  field: (input: FieldInput) => number;
  /** overlay drawn above the canvas */
  overlay?: "outline-logo";
  /** whether the canvas needs the logo silhouette mask */
  usesLogoMask?: boolean;
}

const TWO_PI = Math.PI * 2;

function breath(time: number, period: number, min: number) {
  return min + (1 - min) * (0.5 + 0.5 * Math.sin((time / period) * TWO_PI));
}

/** Diagonal travelling wave, sharpened crests, whole-screen breathing. */
function diagonalWave({ c, r, time, phase }: FieldInput) {
  const wave = Math.sin(0.18 * c + 0.12 * r - (time / 7) * TWO_PI);
  const twinkle = Math.sin((time / 5) * TWO_PI + phase) * 0.3;
  let t = 0.5 + (0.5 * (wave + twinkle)) / 1.3;
  t *= t;
  return t * breath(time, 6, 0.4);
}

/** Concentric ripple expanding from the centre. */
function ripple({ x, y, width, height, time, phase }: FieldInput) {
  const d = Math.hypot(x - width / 2, y - height / 2);
  const wave = Math.sin(d / 55 - (time / 4) * TWO_PI);
  const twinkle = Math.sin((time / 5) * TWO_PI + phase) * 0.2;
  let t = 0.5 + (0.5 * (wave + twinkle)) / 1.2;
  t *= t;
  // fade with distance so the outer rings settle down
  t *= 1 - 0.5 * Math.min(1, d / Math.hypot(width / 2, height / 2));
  return t * breath(time, 6, 0.5);
}

/** A single soft horizontal band sweeping top to bottom. */
function sweep({ y, height, time, phase }: FieldInput) {
  const period = 6;
  const pos = ((time / period) % 1) * (height + 400) - 200;
  const band = Math.exp(-((y - pos) ** 2) / (2 * 120 ** 2));
  const twinkle = 0.12 + 0.08 * Math.sin((time / 4) * TWO_PI + phase);
  return Math.min(1, twinkle + band * 0.9);
}

/** Three slow sines in different directions: cloud-like drifting patches. */
function drift({ c, r, time, phase }: FieldInput) {
  const a = Math.sin(0.11 * c + 0.05 * r + (time / 9) * TWO_PI);
  const b = Math.sin(-0.07 * c + 0.13 * r - (time / 11) * TWO_PI + 1.7);
  const d = Math.sin(0.05 * c - 0.04 * r + (time / 13) * TWO_PI + 3.1);
  const twinkle = Math.sin((time / 5) * TWO_PI + phase) * 0.25;
  let t = 0.5 + (0.5 * (a + b + d + twinkle)) / 3.25;
  t = t * t * 1.4;
  return Math.min(1, t) * breath(time, 7, 0.5);
}

/** Diagonal wave with the logo silhouette lifted out of the field. */
function embossWave(input: FieldInput) {
  const base = diagonalWave(input) * 0.4;
  const pulse = 0.85 + 0.15 * Math.sin((input.time / 3) * TWO_PI);
  return Math.min(1, base + input.logo * pulse);
}

export const COVER_VARIANTS: CoverVariant[] = [
  { id: "wave", label: "Diagonal wave", field: diagonalWave },
  { id: "wave-outline", label: "Wave + outline logo", field: diagonalWave, overlay: "outline-logo" },
  { id: "wave-emboss", label: "Wave + embossed logo", field: embossWave, usesLogoMask: true },
  { id: "ripple", label: "Centre ripple", field: ripple },
  { id: "sweep", label: "Scan sweep", field: sweep },
  { id: "drift", label: "Drifting clouds", field: drift },
];

export const DEFAULT_COVER_ID = "wave";
export const COVER_STORAGE_KEY = "tier0.preview-cover";

export function readCoverId(): string {
  if (typeof window === "undefined") return DEFAULT_COVER_ID;
  const fromUrl = new URLSearchParams(window.location.search).get("cover");
  const candidate = fromUrl ?? safeStorageGet();
  return COVER_VARIANTS.some((v) => v.id === candidate) ? (candidate as string) : DEFAULT_COVER_ID;
}

export function writeCoverId(id: string) {
  try {
    window.localStorage.setItem(COVER_STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

function safeStorageGet(): string | null {
  try {
    return window.localStorage.getItem(COVER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getCoverVariant(id: string): CoverVariant {
  return COVER_VARIANTS.find((v) => v.id === id) ?? COVER_VARIANTS[0];
}
