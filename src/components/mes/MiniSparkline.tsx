"use client";

import { useMemo, useId } from "react";
import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";

/**
 * MiniSparkline — tiny inline area chart for embedding in cards/tables.
 * Pure SVG — no recharts dependency.
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

function buildPath(data: number[], w: number, h: number, padding: number): { line: string; area: string } {
  if (data.length === 0) return { line: "", area: "" };
  if (data.length === 1) {
    const y = h / 2;
    return { line: `M0,${y}L${w},${y}`, area: `M0,${y}L${w},${y}L${w},${h}L0,${h}Z` };
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: padding + ((max - v) / range) * (h - padding * 2),
  }));

  // Monotone cubic interpolation
  const segments: string[] = [`M${points[0].x},${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    segments.push(`C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`);
  }

  const line = segments.join("");
  const last = points[points.length - 1];
  const area = `${line}L${last.x},${h}L${points[0].x},${h}Z`;

  return { line, area };
}

export function MiniSparkline({
  data,
  color = "var(--accent)",
  height = 36,
  width = "100%",
  className,
}: MiniSparklineProps) {
  const gradientId = useId();
  const svgWidth = 120;
  const padding = 2;

  const { line, area } = useMemo(
    () => buildPath(data, svgWidth, height, padding),
    [data, height]
  );

  return (
    <div className={cn("overflow-hidden", className)} style={{ height, width }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
}
