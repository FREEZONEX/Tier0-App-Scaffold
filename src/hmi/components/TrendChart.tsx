"use client";

import { trendBounds, trendPath, type Series } from "@/hmi/charts/trend";

const COLORS = [
  "var(--hmi-selection, #2f8f83)",
  "var(--hmi-interlock, #b58a2e)",
  "var(--hmi-running, #4a9d6f)",
  "var(--hmi-alarm, #b0473d)",
];

/** 多笔趋势：多条序列共享 y 轴铺满，含网格与图例。HP-HMI 低饱和。 */
export function TrendChart({
  series,
  width = 320,
  height = 120,
}: {
  series: readonly Series[];
  width?: number;
  height?: number;
}) {
  const { min, max } = trendBounds(series);
  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  return (
    <div data-testid="trend-chart">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block rounded-sm border border-border bg-surface-inset">
        {/* 网格：3 条水平参考线（与折线共用 translate 收缩坐标系，避免越界错位） */}
        <g transform={`translate(${pad},${pad})`}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} y1={h * f} x2={w} y2={h * f} stroke="var(--border, #ccc)" strokeWidth={0.5} />
          ))}
        </g>
        {series.map((s, i) => (
          <polyline
            key={s.name}
            points={trendPath(s.values, w, h, min, max)}
            transform={`translate(${pad},${pad})`}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {series.length > 1 ? (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {s.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
