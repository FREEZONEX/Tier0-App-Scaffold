function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const START_DEG = 135; // 0 在左下
const SWEEP_DEG = 270; // 顺时针扫到右下

/** value(0–100) → 指针角度（度）。越界自动钳制。 */
export function gaugeAngle(value: number, start = START_DEG, sweep = SWEEP_DEG): number {
  const p = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100;
  return start + p * sweep;
}

/** 极坐标点。 */
export function polar(cx: number, cy: number, deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [round(cx + Math.cos(a) * r), round(cy + Math.sin(a) * r)];
}

/** start→end 的 SVG 圆弧 path（用于量程弧 / 进度弧）。 */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(cx, cy, startDeg, r);
  const [x2, y2] = polar(cx, cy, endDeg, r);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

/** 量程总弧（背景）的 path。 */
export function gaugeTrack(cx: number, cy: number, r: number): string {
  return arcPath(cx, cy, r, START_DEG, START_DEG + SWEEP_DEG);
}

/** 0→value 的进度弧 path。 */
export function gaugeProgress(cx: number, cy: number, r: number, value: number): string {
  return arcPath(cx, cy, r, START_DEG, gaugeAngle(value));
}
