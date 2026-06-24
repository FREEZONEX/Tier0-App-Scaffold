"use client";

import { gaugeTrack, gaugeProgress, gaugeAngle, polar } from "@/hmi/charts/gauge";

/** 径向仪表盘 KPI：量程弧 + 进度弧 + 指针 + 读数。value 0–100。 */
export function RadialGauge({
  value,
  size = 96,
  unit = "%",
  label,
}: {
  value: number;
  size?: number;
  unit?: string;
  label?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const [nx, ny] = polar(cx, cy, gaugeAngle(value), r - 4);
  const shown = Number.isFinite(value) ? Math.round(value) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" data-testid="radial-gauge">
      <path d={gaugeTrack(cx, cy, r)} fill="none" stroke="var(--border, #ccc)" strokeWidth={6} strokeLinecap="round" />
      <path d={gaugeProgress(cx, cy, r, value)} fill="none" stroke="var(--hmi-selection, #2f8f83)" strokeWidth={6} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--hmi-text, #2b2e33)" strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={2.5} fill="var(--hmi-text, #2b2e33)" />
      <text x={cx} y={cy + r / 2.2} textAnchor="middle" className="fill-foreground" style={{ fontSize: size * 0.18, fontWeight: 600 }}>
        {shown}{unit}
      </text>
      {label ? (
        <text x={cx} y={size - 2} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
          {label}
        </text>
      ) : null}
    </svg>
  );
}
