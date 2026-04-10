"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "@/lib/motion";

/**
 * CountdownTimer — live countdown/count-up display for batch timers,
 * cycle times, or shift remaining time. Features animated digit transitions.
 *
 * Usage:
 *   <CountdownTimer targetTime={new Date("2025-01-15T14:30:00")} label="Batch ETA" />
 *   <CountdownTimer targetTime={new Date("2025-01-15T08:00:00")} mode="elapsed" label="Running" />
 */

interface CountdownTimerProps {
  /** Target datetime to count down to (or count up from in elapsed mode). */
  targetTime: Date;
  /** "remaining" counts down to target, "elapsed" counts up from target. Default "remaining". */
  mode?: "remaining" | "elapsed";
  /** Label below the timer */
  label?: string;
  /** Show alert styling when remaining < warningThreshold seconds. Default 300 (5 min). */
  warningThreshold?: number;
  /** Compact single-line mode vs stacked display. Default false. */
  compact?: boolean;
  className?: string;
}

function formatDuration(totalSeconds: number): { h: string; m: string; s: string } {
  const abs = Math.abs(totalSeconds);
  const h = String(Math.floor(abs / 3600)).padStart(2, "0");
  const m = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(abs % 60)).padStart(2, "0");
  return { h, m, s };
}

function FlipDigit({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)} style={{ width: "1.2em" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="inline-block tabular-nums"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FlipGroup({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      {value.split("").map((digit, i) => (
        <FlipDigit key={i} value={digit} className={className} />
      ))}
    </span>
  );
}

export function CountdownTimer({
  targetTime,
  mode = "remaining",
  label,
  warningThreshold = 300,
  compact = false,
  className,
}: CountdownTimerProps) {
  const calcDiff = useCallback(() => {
    const now = Date.now();
    const target = targetTime.getTime();
    return mode === "remaining"
      ? Math.max(0, Math.floor((target - now) / 1000))
      : Math.max(0, Math.floor((now - target) / 1000));
  }, [targetTime, mode]);

  const [diff, setDiff] = useState(calcDiff);

  useEffect(() => {
    const id = setInterval(() => setDiff(calcDiff()), 1000);
    return () => clearInterval(id);
  }, [calcDiff]);

  const { h, m, s } = formatDuration(diff);
  const isWarning = mode === "remaining" && diff <= warningThreshold && diff > 0;
  const isExpired = mode === "remaining" && diff === 0;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium tabular-nums",
          isExpired ? "bg-red-50 text-red-700" : isWarning ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-foreground",
          className
        )}
      >
        {label && <span className="text-muted-foreground">{label}</span>}
        <FlipGroup value={h} />:<FlipGroup value={m} />:<FlipGroup value={s} />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center rounded-lg border px-4 py-3",
        isExpired
          ? "border-red-200 bg-red-50"
          : isWarning
            ? "border-amber-200 bg-amber-50"
            : "border-[var(--border)] bg-white",
        className
      )}
    >
      <div className="flex items-baseline gap-0.5">
        {([h, m, s] as const).map((v, i) => (
          <span key={i} className="contents">
            {i > 0 && <span className="text-lg text-muted-foreground">:</span>}
            <FlipGroup value={v} className={cn("text-2xl font-semibold", isExpired && "text-red-700", isWarning && "text-amber-700")} />
          </span>
        ))}
      </div>
      {label && (
        <span className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
