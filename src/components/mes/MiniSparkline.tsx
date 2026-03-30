"use client";

import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

/**
 * MiniSparkline — tiny inline area chart for embedding in cards/tables.
 *
 * Usage:
 *   <MiniSparkline data={[42, 48, 45, 53, 49, 62, 58]} />
 *   <MiniSparkline data={readings} color="#ef4444" height={32} />
 */

interface MiniSparklineProps {
  /** Array of numeric values. */
  data: number[];
  /** Stroke & fill color. Default: var(--accent). */
  color?: string;
  /** Height in px. Default 36. */
  height?: number;
  /** Width in px or "100%". Default "100%". */
  width?: number | string;
  className?: string;
}

export function MiniSparkline({
  data,
  color = "var(--accent)",
  height = 36,
  width = "100%",
  className,
}: MiniSparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <div className={cn("overflow-hidden", className)} style={{ height, width }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide />
          <defs>
            <linearGradient id={`spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace(/[^a-zA-Z0-9]/g, "")})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
