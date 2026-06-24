function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Series {
  readonly name: string;
  readonly values: readonly number[];
}

/** 多序列共享的 y 轴范围（所有序列一起取 min/max，忽略非有限值）。空 → 0..1。 */
export function trendBounds(series: readonly Series[]): { min: number; max: number } {
  const all = series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
  if (all.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...all);
  const max = Math.max(...all);
  return min === max ? { min, max: min + 1 } : { min, max };
}

/** 在给定 min..max 下把一条序列映射为 SVG polyline points（y 反转，铺满高度）。 */
export function trendPath(values: readonly number[], width: number, height: number, min: number, max: number): string {
  if (values.length === 0) return "";
  const span = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const y = Number.isFinite(v) ? height - ((v - min) / span) * height : height / 2;
      return `${round(i * stepX)},${round(y)}`;
    })
    .join(" ");
}
