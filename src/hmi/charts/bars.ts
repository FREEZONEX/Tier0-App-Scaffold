export interface Bar {
  readonly label: string;
  readonly value: number;
}

export interface BarRect {
  readonly label: string;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 水平棒图布局：每项一行，条宽按 value/max 占比。max 缺省取最大值（至少 1）。 */
export function horizontalBars(bars: readonly Bar[], width: number, rowH: number, gap: number, max?: number): BarRect[] {
  const m = max ?? Math.max(1, ...bars.map((b) => (Number.isFinite(b.value) ? b.value : 0)));
  const denom = m > 0 ? m : 1;
  return bars.map((b, i) => {
    const v = Number.isFinite(b.value) ? Math.max(0, b.value) : 0;
    return { label: b.label, value: b.value, x: 0, y: i * (rowH + gap), w: Math.min(1, v / denom) * width, h: rowH };
  });
}

/** 棒图总高度（供 SVG viewBox）。 */
export function barsHeight(count: number, rowH: number, gap: number): number {
  return count <= 0 ? 0 : count * rowH + (count - 1) * gap;
}
