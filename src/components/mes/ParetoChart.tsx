"use client";

import { cn } from "@/lib/utils";
import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";

/**
 * ParetoChart — bar + cumulative line chart for quality analysis.
 * The #1 quality tool in manufacturing (80/20 rule visualization).
 *
 * Usage:
 *   <ParetoChart
 *     data={[
 *       { label: "Scratches", count: 42 },
 *       { label: "Dents", count: 28 },
 *       { label: "Misalignment", count: 15 },
 *       { label: "Color", count: 8 },
 *       { label: "Other", count: 5 },
 *     ]}
 *   />
 */

interface ParetoDataItem {
  label: string;
  count: number;
}

interface ParetoChartProps {
  /** Data items — will be sorted by count descending automatically. */
  data: ParetoDataItem[];
  /** Chart height in px. Default 280. */
  height?: number;
  /** Y-axis label */
  label?: string;
  className?: string;
}

export function ParetoChart({
  data,
  height = 280,
  label = "Count",
  className,
}: ParetoChartProps) {
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, d) => sum + d.count, 0);

    // Build cumulative running totals functionally to keep the map body pure.
    const cumulativeArr = sorted.reduce<number[]>(
      (acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d.count],
      [],
    );
    return sorted.map((d, i) => {
      const cumulative = cumulativeArr[i];
      return {
        label: d.label,
        count: d.count,
        cumulative: total > 0 ? (cumulative / total) * 100 : 0,
      };
    });
  }, [data]);

  if (!data.length) {
    return (
      <div className={cn("flex items-center justify-center rounded-lg border border-[var(--border)] bg-white", className)} style={{ height }}>
        <span className="text-xs text-muted-foreground">No data</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]", className)}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              axisLine={{ stroke: "#e4e4e7" }}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              yAxisId="count"
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              label={{ value: label, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#a1a1aa" } }}
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                fontFamily: "IBM Plex Mono, monospace",
                borderRadius: 8,
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-md)",
              }}
              formatter={((value: any, name: any) =>
                name === "cumulative" ? [`${Number(value).toFixed(1)}%`, "Cumulative"] : [value, label]
              ) as any}
            />
            <ReferenceLine
              yAxisId="cumulative"
              y={80}
              stroke="#a1a1aa"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "80%", position: "right", style: { fontSize: 9, fill: "#a1a1aa" } }}
            />
            <Bar
              yAxisId="count"
              dataKey="count"
              fill="#d4d4d8"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
            <Line
              yAxisId="cumulative"
              dataKey="cumulative"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--accent)", stroke: "white", strokeWidth: 2 }}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
