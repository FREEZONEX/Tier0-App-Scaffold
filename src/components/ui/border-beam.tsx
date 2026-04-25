"use client"

import { cn } from "@/lib/utils"

/**
 * BorderBeam — animated gradient beam that travels along the border of a container.
 * Place inside a `relative overflow-hidden` parent.
 *
 * Usage:
 *   <div className="relative overflow-hidden rounded-lg border ...">
 *     <BorderBeam />
 *     {children}
 *   </div>
 */

interface BorderBeamProps {
  /** Animation cycle duration in seconds. Default 6. */
  duration?: number
  /** Beam width in pixels. Default 100. */
  size?: number
  /** Beam color. Default var(--accent). */
  color?: string
  className?: string
}

function BorderBeam({
  duration = 6,
  size = 100,
  color = "var(--accent)",
  className,
}: BorderBeamProps) {
  return (
    <div
      data-slot="border-beam"
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", className)}
      style={{
        /* offset-path traces the border rectangle */
        offsetPath: `rect(0 auto auto 0 round ${size}px)`,
      }}
    >
      <div
        className="absolute h-[2px]"
        style={{
          width: size,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          offsetPath: "inherit",
          animation: `border-beam ${duration}s linear infinite`,
        }}
      />
    </div>
  )
}

export { BorderBeam }
