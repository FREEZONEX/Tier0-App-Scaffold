"use client";

import { horizontalBars, barsHeight, type Bar } from "@/hmi/charts/bars";

const ROW = 16;
const GAP = 6;
const LABEL_W = 64;

/** 水平棒图：对比多设备数值。标签在左、条 + 数值在右。HP-HMI 低饱和。 */
export function BarChart({
  bars,
  width = 320,
  unit = "",
  max,
}: {
  bars: readonly Bar[];
  width?: number;
  unit?: string;
  max?: number;
}) {
  const barW = width - LABEL_W - 8;
  const rects = horizontalBars(bars, barW, ROW, GAP, max);
  const h = barsHeight(bars.length, ROW, GAP);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${width} ${h}`} className="block" data-testid="bar-chart">
      {rects.map((r) => (
        <g key={r.label} transform={`translate(0,${r.y})`}>
          <text x={0} y={ROW / 2} dominantBaseline="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
            {r.label}
          </text>
          <rect x={LABEL_W} y={2} width={Math.max(1, r.w)} height={ROW - 4} rx={1} fill="var(--hmi-selection, #2f8f83)" opacity={0.75} />
          <text x={LABEL_W + Math.max(1, r.w) + 4} y={ROW / 2} dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 10, fontWeight: 600 }}>
            {Number.isFinite(r.value) ? Math.round(r.value * 10) / 10 : "--"}{unit}
          </text>
        </g>
      ))}
    </svg>
  );
}
