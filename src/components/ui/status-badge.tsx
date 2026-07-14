import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — the one shape for lifecycle/status labels. Colors come from
 * the scaffold state recipes (.state-*); the badge fixes size, radius and
 * weight so every app's statuses look consistent.
 *
 * Tones map to the semantic state tokens:
 * - running: active/ok/in-progress (brand green family)
 * - idle:    neutral/draft/inactive
 * - paused:  warning/near-expiry/on-hold
 * - error:   failed/expired/blocked
 * - info:    informational/queued
 */
export type StatusTone = "running" | "idle" | "paused" | "error" | "info";

const toneClass: Record<StatusTone, string> = {
  running: "state-running",
  idle: "state-idle",
  paused: "state-paused",
  error: "state-error",
  info: "state-info",
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  children: ReactNode;
}

export function StatusBadge({
  tone,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-4",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
