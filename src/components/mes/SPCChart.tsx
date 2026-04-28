"use client";

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Scatter,
  ComposedChart,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * SPCChart — Statistical Process Control chart (X-bar style).
 * Draws a data line with UCL / LCL / CL reference lines and highlights
 * out-of-control points in red.
 *
 * Usage:
 *   <SPCChart
 *     data={[{ x: "08:00", value: 25.1 }, { x: "08:05", value: 24.8 }, ...]}
 *     ucl={26} lcl={24} cl={25}
 *     label="Temperature (°C)"
 *   />
 */

interface SPCDataPoint {
  /** X-axis label (time, sample number, etc.) */
  x: string;
  /** Measured value */
  value: number;
}

interface SPCChartProps {
  data: SPCDataPoint[];
  /** Upper Control Limit */
  ucl: number;
  /** Lower Control Limit */
  lcl: number;
  /** Center Line (target) */
  cl: number;
  /** Chart title */
  label?: string;
  /** Height in pixels. Default 260. */
  height?: number;
  className?: string;
}

export function SPCChart({ data, ucl, lcl, cl, label, height = 260, className }: SPCChartProps) {
  const violations = data
    .filter((d) => d.value > ucl || d.value < lcl)
    .map((d) => ({ ...d, violation: d.value }));

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <p className="mb-2 text-xs font-medium">{label}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="x" tick={{ fontSize: 10 }} stroke="#a1a1aa" />
          <YAxis tick={{ fontSize: 10 }} stroke="#a1a1aa" domain={[lcl - (ucl - lcl) * 0.2, ucl + (ucl - lcl) * 0.2]} />
          <Tooltip
            contentStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono", border: "1px solid #e4e4e7", borderRadius: 6 }}
          />

          {/* Control limits */}
          <ReferenceLine y={ucl} stroke="#ef4444" strokeDasharray="6 3" label={{ value: "UCL", position: "right", fontSize: 10, fill: "#ef4444" }} />
          <ReferenceLine y={cl} stroke="#71717a" strokeDasharray="4 2" label={{ value: "CL", position: "right", fontSize: 10, fill: "#71717a" }} />
          <ReferenceLine y={lcl} stroke="#ef4444" strokeDasharray="6 3" label={{ value: "LCL", position: "right", fontSize: 10, fill: "#ef4444" }} />

          {/* Data line */}
          <Line type="monotone" dataKey="value" stroke="#18181b" strokeWidth={1.5} dot={{ r: 2.5, fill: "#18181b" }} activeDot={{ r: 4 }} />

          {/* Out-of-control points */}
          <Scatter data={violations} dataKey="violation" fill="#ef4444" shape="circle" legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
