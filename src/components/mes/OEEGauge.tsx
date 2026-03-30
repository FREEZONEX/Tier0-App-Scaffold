"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/**
 * OEEGauge — three-ring donut showing Availability / Performance / Quality
 * with a center OEE value.
 *
 * Usage:
 *   <OEEGauge availability={92} performance={87} quality={98} />
 */

interface OEEGaugeProps {
  /** Availability percentage 0-100 */
  availability: number;
  /** Performance percentage 0-100 */
  performance: number;
  /** Quality percentage 0-100 */
  quality: number;
  /** Width & height in pixels. Default 200. */
  size?: number;
  className?: string;
}

function ring(value: number, color: string) {
  return [
    { value, fill: color },
    { value: 100 - value, fill: "transparent" },
  ];
}

export function OEEGauge({
  availability,
  performance,
  quality,
  size = 200,
  className,
}: OEEGaugeProps) {
  const oee = Math.round((availability * performance * quality) / 10000);
  const trackColor = "#f4f4f5"; // gray-100

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* Track rings (background) */}
          <Pie data={[{ value: 100 }]} dataKey="value" cx="50%" cy="50%" innerRadius="78%" outerRadius="88%" startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={trackColor} />
          </Pie>
          <Pie data={[{ value: 100 }]} dataKey="value" cx="50%" cy="50%" innerRadius="60%" outerRadius="70%" startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={trackColor} />
          </Pie>
          <Pie data={[{ value: 100 }]} dataKey="value" cx="50%" cy="50%" innerRadius="42%" outerRadius="52%" startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={trackColor} />
          </Pie>

          {/* Value rings */}
          <Pie data={ring(availability, "var(--accent)")} dataKey="value" cx="50%" cy="50%" innerRadius="78%" outerRadius="88%" startAngle={90} endAngle={-270} stroke="none" cornerRadius={4}>
            {ring(availability, "").map((_, i) => (
              <Cell key={i} fill={i === 0 ? "var(--accent)" : "transparent"} />
            ))}
          </Pie>
          <Pie data={ring(performance, "#71717a")} dataKey="value" cx="50%" cy="50%" innerRadius="60%" outerRadius="70%" startAngle={90} endAngle={-270} stroke="none" cornerRadius={4}>
            {ring(performance, "").map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#71717a" : "transparent"} />
            ))}
          </Pie>
          <Pie data={ring(quality, "#27272a")} dataKey="value" cx="50%" cy="50%" innerRadius="42%" outerRadius="52%" startAngle={90} endAngle={-270} stroke="none" cornerRadius={4}>
            {ring(quality, "").map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#27272a" : "transparent"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">{oee}%</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">OEE</span>
      </div>

      {/* Legend */}
      <div className="mt-2 flex justify-center gap-3 text-[10px]">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" />A {availability}%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#71717a]" />P {performance}%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#27272a]" />Q {quality}%</span>
      </div>
    </div>
  );
}
