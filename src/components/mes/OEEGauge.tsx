"use client";

import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * OEEGauge — three-ring donut showing Availability / Performance / Quality
 * with a center OEE value. Pure SVG + motion — no recharts dependency.
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

const trackColor = "#f4f4f5";

const springTransition = {
  type: "spring" as const,
  stiffness: 60,
  damping: 15,
};

function Ring({ value, color, radius, strokeWidth, center }: RingProps) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);

  return (
    <>
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {/* Value */}
      <motion.circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
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

export function OEEGauge({
  availability,
  performance,
  quality,
  size = 200,
  className,
}: OEEGaugeProps) {
  const oee = Math.round((availability * performance * quality) / 10000);
  const center = size / 2;
  const strokeWidth = size * 0.06;
  const gap = size * 0.04;

  const outerR = center - strokeWidth / 2 - 2;
  const midR = outerR - strokeWidth - gap;
  const innerR = midR - strokeWidth - gap;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Ring value={availability} color="var(--accent)" radius={outerR} strokeWidth={strokeWidth} center={center} />
        <Ring value={performance} color="#71717a" radius={midR} strokeWidth={strokeWidth} center={center} />
        <Ring value={quality} color="#27272a" radius={innerR} strokeWidth={strokeWidth} center={center} />
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">
          <AnimatedNumber value={oee} format={(n) => `${Math.round(n)}%`} />
        </span>
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
