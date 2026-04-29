"use client";

import { cn } from "@/lib/utils";
import {
  Play,
  CheckCircle2,
  Pause,
  AlertTriangle,
  XCircle,
  Wrench,
  Circle,
  type LucideIcon,
} from "lucide-react";

/**
 * StateBadge — color-coded status indicator with icon redundancy.
 *
 * Color alone is not enough to communicate state in industrial settings
 * (color-blindness, glare, monochrome printing). Every state ships with
 * an icon AND a label so the meaning survives any of those degradations.
 *
 * Usage:
 *   <StateBadge state="running" />
 *   <StateBadge state="down" label="Machine Fault" />
 *   <StateBadge state="idle" size="lg" />
 *
 * Built-in palette covers common MES states. Pass `colorMap` to override
 * or add new states.
 */

interface StateStyle {
  /** CSS class supplying fg/bg/border via the global state-* utilities */
  utility:
    | "state-running"
    | "state-idle"
    | "state-paused"
    | "state-error"
    | "state-info";
  icon: LucideIcon;
  /** If true, the dot pulses to indicate live activity */
  live?: boolean;
}

const defaultStyles: Record<string, StateStyle> = {
  // Running / active
  running:     { utility: "state-running", icon: Play, live: true },
  active:      { utility: "state-running", icon: Play, live: true },
  // Completed / passed
  completed:   { utility: "state-running", icon: CheckCircle2 },
  done:        { utility: "state-running", icon: CheckCircle2 },
  passed:      { utility: "state-running", icon: CheckCircle2 },
  // Idle / pending / draft
  idle:        { utility: "state-idle", icon: Circle },
  pending:     { utility: "state-idle", icon: Circle },
  draft:       { utility: "state-idle", icon: Circle },
  // Paused / warning
  paused:      { utility: "state-paused", icon: Pause },
  warning:     { utility: "state-paused", icon: AlertTriangle },
  // Maintenance — distinct blue, not amber, so operators can tell at a glance
  maintenance: { utility: "state-info",   icon: Wrench },
  // Error / fault
  down:        { utility: "state-error", icon: XCircle },
  failed:      { utility: "state-error", icon: XCircle },
  rejected:    { utility: "state-error", icon: XCircle },
  blocked:     { utility: "state-error", icon: XCircle },
};

interface StateBadgeProps {
  /** The state key — matched against built-in styles (case-insensitive). */
  state: string;
  /** Override the display label. Defaults to the state value, capitalized. */
  label?: string;
  /** Additional state styles or overrides. */
  colorMap?: Record<string, StateStyle>;
  /** Size variant. */
  size?: "sm" | "md" | "lg";
  /** Hide the icon (color + label only). Default false. Not recommended. */
  iconHidden?: boolean;
  className?: string;
}

const sizes = {
  sm: { container: "px-1.5 py-0.5 text-[11px] gap-1",   icon: "size-3",    dot: "size-1.5" },
  md: { container: "px-2 py-0.5 text-xs gap-1.5",       icon: "size-3.5",  dot: "size-2"   },
  lg: { container: "px-2.5 py-1 text-sm gap-1.5",       icon: "size-4",    dot: "size-2"   },
};

export function StateBadge({
  state,
  label,
  colorMap,
  size = "md",
  iconHidden = false,
  className,
}: StateBadgeProps) {
  const merged = { ...defaultStyles, ...colorMap };
  const fallback: StateStyle = { utility: "state-idle", icon: Circle };
  const style = merged[state.toLowerCase()] ?? fallback;
  const displayLabel =
    label ?? state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
  const Icon = style.icon;
  const s = sizes[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border font-medium whitespace-nowrap",
        style.utility,
        s.container,
        className,
      )}
    >
      {!iconHidden && (
        <span className="relative inline-flex shrink-0 items-center justify-center">
          <Icon className={s.icon} aria-hidden />
          {style.live && (
            <span
              className={cn(
                "absolute rounded-full border-2 border-current",
                s.dot,
              )}
              style={{ animation: "ping-dot 1.6s cubic-bezier(0, 0, 0.2, 1) infinite" }}
              aria-hidden
            />
          )}
        </span>
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
