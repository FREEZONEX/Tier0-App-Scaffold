/**
 * Cover variants for the pre-generation placeholder. Each variant is a pure
 * brightness field t(cell, time, settings) in [0, 1] over the glyph grid. The
 * active variant and every tunable live in `CoverSettings`, driven by the
 * dat.gui panel on the cover while the visual is being evaluated.
 */

export const LOGO_TILE_SIZE = 42;
export const LOGO_T_PATH =
  "M11.028 29.0898V14.7378H6.13195V12.2898H18.708V14.7378H13.812V29.0898H11.028Z";
export const LOGO_ZERO_PATH =
  "M21.2388 26.8338V14.5458L23.4948 12.2898H31.9428L34.1988 14.5458V26.8338L31.9428 29.0898H23.4948L21.2388 26.8338ZM24.0228 14.7858V26.5938H31.4148V14.7858H24.0228Z";

export type CoverVariantId = "drift" | "emboss";

export interface CoverSettings {
  variant: CoverVariantId;

  // Grid
  /** cell pitch in CSS px */
  cell: number;
  /** glyph font size in CSS px */
  fontSize: number;
  /** fraction of cells that are drawn at all (1 = every cell) */
  density: number;
  /** probability a cell flips glyph per flip tick */
  flipChance: number;
  /** ms between flip ticks */
  flipInterval: number;

  // Brightness / colour
  alphaBase: number;
  alphaRange: number;
  /** cap on grey -> highlight mix at t = 1 */
  colorMix: number;
  /** contrast exponent applied to t */
  contrast: number;

  // Motion
  /** global time multiplier */
  speed: number;
  /** spatial scale of the field: >1 = bigger patches */
  scale: number;
  breathPeriod: number;
  breathMin: number;
  twinkle: number;

  // Emboss only
  /** logo size as a fraction of min(width, height) */
  logoSize: number;
  /** weight of the drifting field outside the logo */
  logoBase: number;
  /** brightness added inside the logo */
  logoStrength: number;
  logoPulsePeriod: number;
  /** softness of the logo edge in cells */
  logoFeather: number;

  // Evaluation aids
  /** overlay a blurred white layer like the platform wait mask */
  simulateMask: boolean;
  maskOpacity: number;
  maskBlur: number;
}

export const DEFAULT_COVER_SETTINGS: CoverSettings = {
  variant: "drift",

  cell: 30,
  fontSize: 12,
  density: 1,
  flipChance: 0.15,
  flipInterval: 120,

  alphaBase: 0.05,
  alphaRange: 0.7,
  colorMix: 0.95,
  contrast: 2,

  speed: 1,
  scale: 1,
  breathPeriod: 7,
  breathMin: 0.5,
  twinkle: 0.25,

  logoSize: 0.6,
  logoBase: 0.4,
  logoStrength: 0.85,
  logoPulsePeriod: 3,
  logoFeather: 1,

  simulateMask: false,
  maskOpacity: 0.7,
  maskBlur: 12,
};

export interface FieldInput {
  c: number;
  r: number;
  time: number;
  /** stable per-cell phase in [0, 2π) */
  phase: number;
  /** 0..1 weight of the logo silhouette at this cell (emboss only) */
  logo: number;
}

const TWO_PI = Math.PI * 2;

function breath(time: number, s: CoverSettings) {
  if (s.breathPeriod <= 0) return 1;
  return s.breathMin + (1 - s.breathMin) * (0.5 + 0.5 * Math.sin((time / s.breathPeriod) * TWO_PI));
}

/** Three slow sines in different directions: cloud-like drifting patches. */
export function driftField({ c, r, time, phase }: FieldInput, s: CoverSettings) {
  const k = 1 / s.scale;
  const a = Math.sin(k * (0.11 * c + 0.05 * r) + (time / 9) * TWO_PI);
  const b = Math.sin(k * (-0.07 * c + 0.13 * r) - (time / 11) * TWO_PI + 1.7);
  const d = Math.sin(k * (0.05 * c - 0.04 * r) + (time / 13) * TWO_PI + 3.1);
  const tw = Math.sin((time / 5) * TWO_PI + phase) * s.twinkle;
  let t = 0.5 + (0.5 * (a + b + d + tw)) / (3 + s.twinkle);
  t = Math.pow(Math.max(0, t), s.contrast) * 1.4;
  return Math.min(1, t) * breath(time, s);
}

/** Drifting field with the logo silhouette lifted out of it. */
export function embossField(input: FieldInput, s: CoverSettings) {
  const base = driftField(input, s) * s.logoBase;
  const pulse =
    s.logoPulsePeriod > 0
      ? 1 - 0.15 + 0.15 * Math.sin((input.time / s.logoPulsePeriod) * TWO_PI)
      : 1;
  return Math.min(1, base + input.logo * s.logoStrength * pulse);
}

export const COVER_VARIANTS: { id: CoverVariantId; label: string }[] = [
  { id: "drift", label: "Drifting clouds" },
  { id: "emboss", label: "Embossed logo" },
];

export function fieldFor(id: CoverVariantId) {
  return id === "emboss" ? embossField : driftField;
}
