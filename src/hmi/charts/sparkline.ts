function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 把数值序列映射为 SVG polyline 的 points 字符串（y 轴反转，min..max 铺满高度）。
 * 常量序列居中平线；空序列返回空串。
 */
export function sparklinePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return "";
  // 仅用有限值定范围，避免单个 NaN/Infinity 把 min/max 污染成 NaN 使整条线消失
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return "";
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = !Number.isFinite(v) || span === 0 ? height / 2 : height - ((v - min) / span) * height;
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}
