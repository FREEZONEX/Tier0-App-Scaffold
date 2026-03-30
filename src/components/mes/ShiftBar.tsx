"use client";

import { cn } from "@/lib/utils";

/**
 * ShiftBar — horizontal shift schedule indicator showing current shift context.
 *
 * Usage:
 *   <ShiftBar shifts={[
 *     { label: "Morning", start: 6, end: 14, color: "#B2ED1D" },
 *     { label: "Afternoon", start: 14, end: 22, color: "#71717a" },
 *     { label: "Night", start: 22, end: 6, color: "#27272a" },
 *   ]} currentHour={10} />
 */

interface Shift {
  label: string;
  /** Start hour (0-23) */
  start: number;
  /** End hour (0-23). If end < start, wraps past midnight. */
  end: number;
  /** Segment fill color */
  color: string;
}

interface ShiftBarProps {
  shifts: Shift[];
  /** Current hour (0-23). Shows a marker. Pass undefined to hide marker. */
  currentHour?: number;
  /** Total hours displayed. Default 24. */
  totalHours?: number;
  /** Start hour of the bar. Default 0. */
  startHour?: number;
  className?: string;
}

function normalizeWidth(start: number, end: number, total: number): number {
  if (end > start) return ((end - start) / total) * 100;
  return ((total - start + end) / total) * 100;
}

function normalizeOffset(start: number, barStart: number, total: number): number {
  return (((start - barStart + total) % total) / total) * 100;
}

export function ShiftBar({
  shifts,
  currentHour,
  totalHours = 24,
  startHour = 0,
  className,
}: ShiftBarProps) {
  const markerPos = currentHour !== undefined
    ? (((currentHour - startHour + totalHours) % totalHours) / totalHours) * 100
    : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Bar */}
      <div className="relative h-6 w-full overflow-hidden rounded-md bg-gray-100">
        {shifts.map((shift) => {
          const left = normalizeOffset(shift.start, startHour, totalHours);
          const width = normalizeWidth(shift.start, shift.end, totalHours);
          return (
            <div
              key={shift.label}
              className="absolute inset-y-0 flex items-center justify-center text-[10px] font-medium"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: shift.color,
                color: shift.color === "#27272a" || shift.color === "#71717a" ? "#fff" : "#000",
              }}
              title={`${shift.label}: ${shift.start}:00 – ${shift.end}:00`}
            >
              {width > 8 && shift.label}
            </div>
          );
        })}

        {/* Current-time marker */}
        {markerPos !== undefined && (
          <div
            className="absolute inset-y-0 w-0.5 bg-red-500 shadow-sm"
            style={{ left: `${markerPos}%` }}
          >
            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white" />
          </div>
        )}
      </div>

      {/* Hour ticks */}
      <div className="relative h-3 w-full">
        {Array.from({ length: Math.floor(totalHours / 3) + 1 }, (_, i) => {
          const hour = (startHour + i * 3) % 24;
          const left = (i * 3 / totalHours) * 100;
          return (
            <span
              key={i}
              className="absolute text-[9px] tabular-nums text-muted-foreground -translate-x-1/2"
              style={{ left: `${left}%` }}
            >
              {String(hour).padStart(2, "0")}
            </span>
          );
        })}
      </div>
    </div>
  );
}
