"use client";

import { useMemo, useRef, useState } from "react";
import { alignSeries, nearestPointIndex, cellText, type TrendPoint } from "@/hmi/data/uns-history";

interface TrendSeriesInput {
  name: string;
  points: readonly TrendPoint[];
}

const COLORS = [
  "var(--hmi-selection, #2f8f83)",
  "var(--hmi-interlock, #b58a2e)",
  "var(--hmi-running, #4a9d6f)",
  "var(--hmi-alarm, #b0473d)",
  "#5b6fb0",
  "#9c5bb0",
  "#3f8fb0",
  "#b07a3f",
];

const M = { left: 46, right: 12, top: 10, bottom: 24 } as const;

function bounds(columns: { values: (number | null)[] }[]): { min: number; max: number } {
  const all: number[] = [];
  for (const c of columns) for (const v of c.values) if (v !== null && Number.isFinite(v)) all.push(v);
  if (all.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...all);
  const max = Math.max(...all);
  return min === max ? { min, max: min + 1 } : { min, max };
}

/**
 * 历史聚合趋势：多系列共享时间 x 轴（alignSeries 对齐）+ y 轴 min/max 标签 + 图例。
 * 交互：hover 竖向游标 + 各系列圆点 + tooltip（时间范围用对话框上方的预设/自定义选择，不再支持拖拽框选缩放）。
 * 固定像素尺寸渲染（viewBox 1:1），使鼠标 offset 直接映射为绘图坐标。
 */
export function HistoryTrendChart({
  series,
  formatTime,
  emptyLabel,
  width = 660,
  height = 280,
}: {
  series: readonly TrendSeriesInput[];
  formatTime: (ms: number) => string;
  emptyLabel: string;
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  // hover/drag 是 60fps 高频 setState：对齐/归一/范围都包 useMemo，只在数据或归一开关变化时重算
  const aligned = useMemo(() => alignSeries(series.map((s) => ({ name: s.name, points: s.points }))), [series]);
  const times = aligned.times;
  const columns = aligned.columns;
  const { min, max } = useMemo(() => bounds(columns), [columns]);
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const span = max - min || 1;
  const xOf = (i: number) => (times.length > 1 ? (i / (times.length - 1)) * plotW : plotW / 2);
  const yOf = (v: number) => plotH - ((v - min) / span) * plotH;

  const ratioFromEvent = (clientX: number): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left - M.left;
    return Math.max(0, Math.min(1, plotW > 0 ? x / plotW : 0));
  };

  const hasData = times.length > 0;

  return (
    <div ref={ref} className="relative select-none" style={{ width, height }} data-testid="history-trend-chart">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block rounded-sm border border-border bg-surface-inset"
        onMouseMove={(e) => setHover(nearestPointIndex(times.length, ratioFromEvent(e.clientX)))}
        onMouseLeave={() => setHover(null)}
      >
        <g transform={`translate(${M.left},${M.top})`}>
          {/* 网格 + y 轴标签 */}
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={0} y1={plotH * f} x2={plotW} y2={plotH * f} stroke="var(--border, #ccc)" strokeWidth={0.5} />
          ))}
          {hasData ? (
            <>
              <text x={-6} y={4} textAnchor="end" className="fill-muted-foreground text-[9px]">
                {round2(max)}
              </text>
              <text x={-6} y={plotH} textAnchor="end" className="fill-muted-foreground text-[9px]">
                {round2(min)}
              </text>
            </>
          ) : null}

          {/* 各系列折线（跳过缺口 null） */}
          {columns.map((col, ci) => {
            const pts = col.values
              .map((v, i) => (v !== null && Number.isFinite(v) ? `${round2(xOf(i))},${round2(yOf(v))}` : null))
              .filter((p): p is string => p !== null)
              .join(" ");
            return pts ? (
              <polyline
                key={ci}
                points={pts}
                fill="none"
                stroke={COLORS[ci % COLORS.length]}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null;
          })}

          {/* hover 游标线 + 各系列圆点 */}
          {hover !== null && hover >= 0 && hasData ? (
            <>
              <line x1={xOf(hover)} y1={0} x2={xOf(hover)} y2={plotH} stroke="var(--focus-accent, #2f8f83)" strokeWidth={0.75} strokeDasharray="3 2" />
              {columns.map((col, ci) => {
                const v = col.values[hover];
                return v !== null && Number.isFinite(v) ? (
                  <circle key={ci} cx={xOf(hover)} cy={yOf(v)} r={2.5} fill={COLORS[ci % COLORS.length]} />
                ) : null;
              })}
            </>
          ) : null}
        </g>

        {/* x 轴时间刻度 */}
        {hasData
          ? timeTicks(times.length).map((i) => (
              <text
                key={i}
                x={M.left + xOf(i)}
                y={height - 7}
                textAnchor={i === 0 ? "start" : i === times.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground text-[9px]"
              >
                {formatTime(times[i])}
              </text>
            ))
          : null}

        {!hasData ? (
          <text x={width / 2} y={height / 2} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {emptyLabel}
          </text>
        ) : null}
      </svg>

      {/* 图例 */}
      {series.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {s.name}
            </li>
          ))}
        </ul>
      ) : null}

      {/* hover tooltip */}
      {hover !== null && hover >= 0 && hasData ? (
        <div
          className="pointer-events-none absolute z-10 rounded-sm border border-border bg-card px-2 py-1 text-[10px] shadow-md"
          style={{ left: Math.min(width - 140, M.left + xOf(hover) + 8), top: M.top + 4 }}
        >
          <div className="mb-0.5 font-mono text-muted-foreground">{formatTime(times[hover])}</div>
          {columns.map((col, ci) => (
            <div key={ci} className="flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: COLORS[ci % COLORS.length] }} />
              <span className="text-muted-foreground">{col.name}</span>
              <span className="ml-auto font-mono text-foreground">{cellText(col.values[hover])}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 选 ~4 个均匀刻度索引（含首尾）。 */
function timeTicks(count: number): number[] {
  if (count <= 1) return count === 1 ? [0] : [];
  const n = Math.min(4, count);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(Math.round((k / (n - 1)) * (count - 1)));
  return [...new Set(out)];
}
