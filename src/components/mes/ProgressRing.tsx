"use client";

import { cn } from "@/lib/utils";

/**
 * ProgressRing — single-metric circular progress indicator.
 * Lighter-weight than OEEGauge for simple completion/utilization metrics.
 *
 * Usage:
 *   <ProgressRing value={72} label="Yield" />
 *   <ProgressRing value={45} label="Utilization" size={80} strokeWidth={6} color="#71717a" />
 */

interface ProgressRingProps {
  /** Value 0-100 */
  value: number;
  /** Center sub-label */
  label?: string;
  /** Diameter in px. Default 96. */
  size?: number;
  /** Ring thickness in px. Default 5. */
  strokeWidth?: number;
  /** Ring color. Default var(--accent). */
  color?: string;
  /** Track color. Default #f4f4f5. */
  trackColor?: string;
  className?: string;
}

export function ProgressRing({
  value,
  label,
  size = 96,
  strokeWidth = 5,
  color = "var(--accent)",
  trackColor = "#f4f4f5",
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Value */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums">{Math.round(value)}%</span>
        {label && (
          <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
