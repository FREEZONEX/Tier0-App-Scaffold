"use client";

import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * OEEGauge — three-ring donut showing Availability / Performance / Quality
 * with a center OEE value. Pure SVG + motion — no recharts dependency.
 *
 * Ring color follows MES convention: A = blue, P = amber, Q = green.
 * Three distinct hues so an operator can read each component at a glance.
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

interface RingProps {
  value: number;
  color: string;
  radius: number;
  strokeWidth: number;
  center: number;
}

const trackColor = "oklch(0.92 0 0)";

const springTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 22,
};

function Ring({ value, color, radius, strokeWidth, center }: RingProps) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);

  return (
    <>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={springTransition}
        style={{
          transform: `rotate(-90deg)`,
          transformOrigin: `${center}px ${center}px`,
        }}
      />
    </>
  );
}

const COLOR_A = "var(--state-info-fg)";    // Availability — blue
const COLOR_P = "var(--state-paused-fg)";  // Performance  — amber
const COLOR_Q = "var(--state-running-fg)"; // Quality      — green

export function OEEGauge({
  availability,
  performance,
  quality,
  size = 200,
  className,
}: OEEGaugeProps) {
  // OEE is a product of fractions, so divide by 10000 to keep result 0–100.
  const oee = Math.round((availability * performance * quality) / 10000);
  const center = size / 2;
  // Slightly thicker rings for industrial readability
  const strokeWidth = size * 0.08;
  const gap = size * 0.03;

  const outerR = center - strokeWidth / 2 - 2;
  const midR = outerR - strokeWidth - gap;
  const innerR = midR - strokeWidth - gap;

  return (
    <div className={cn("relative", className)} style={{ width: size }}>
      <div style={{ width: size, height: size, position: "relative" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Ring value={availability} color={COLOR_A} radius={outerR} strokeWidth={strokeWidth} center={center} />
          <Ring value={performance} color={COLOR_P} radius={midR}   strokeWidth={strokeWidth} center={center} />
          <Ring value={quality}     color={COLOR_Q} radius={innerR} strokeWidth={strokeWidth} center={center} />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
            <AnimatedNumber value={oee} format={(n) => `${Math.round(n)}%`} />
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            OEE
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex justify-center gap-4 text-[11px] font-medium">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: COLOR_A }} />
          <span className="text-muted-foreground">A</span>
          <span className="font-mono tabular-nums">{availability}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: COLOR_P }} />
          <span className="text-muted-foreground">P</span>
          <span className="font-mono tabular-nums">{performance}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: COLOR_Q }} />
          <span className="text-muted-foreground">Q</span>
          <span className="font-mono tabular-nums">{quality}%</span>
        </span>
      </div>
    </div>
  );
}
