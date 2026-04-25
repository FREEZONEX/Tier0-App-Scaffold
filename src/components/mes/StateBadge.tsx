"use client";

import { cn } from "@/lib/utils";

/**
 * StateBadge — color-coded status indicator for manufacturing states.
 *
 * Usage:
 *   <StateBadge state="running" />
 *   <StateBadge state="down" label="Machine Fault" />
 *   <StateBadge state="idle" size="lg" />
 *
 * Built-in palette covers common MES states. Pass `colorMap` to override.
 */

const defaultColorMap: Record<string, { bg: string; text: string; dot: string }> = {
  running:     { bg: "bg-[var(--accent)]/15", text: "text-[var(--accent-strong)]", dot: "bg-[var(--accent)]" },
  active:      { bg: "bg-[var(--accent)]/15", text: "text-[var(--accent-strong)]", dot: "bg-[var(--accent)]" },
  completed:   { bg: "bg-emerald-50",         text: "text-emerald-700",            dot: "bg-emerald-500" },
  done:        { bg: "bg-emerald-50",         text: "text-emerald-700",            dot: "bg-emerald-500" },
  passed:      { bg: "bg-emerald-50",         text: "text-emerald-700",            dot: "bg-emerald-500" },
  idle:        { bg: "bg-gray-100",           text: "text-gray-600",              dot: "bg-gray-400" },
  pending:     { bg: "bg-gray-100",           text: "text-gray-600",              dot: "bg-gray-400" },
  draft:       { bg: "bg-gray-100",           text: "text-gray-600",              dot: "bg-gray-400" },
  paused:      { bg: "bg-amber-50",           text: "text-amber-700",             dot: "bg-amber-500" },
  maintenance: { bg: "bg-amber-50",           text: "text-amber-700",             dot: "bg-amber-500" },
  warning:     { bg: "bg-amber-50",           text: "text-amber-700",             dot: "bg-amber-500" },
  down:        { bg: "bg-red-50",             text: "text-red-700",               dot: "bg-red-500" },
  failed:      { bg: "bg-red-50",             text: "text-red-700",               dot: "bg-red-500" },
  rejected:    { bg: "bg-red-50",             text: "text-red-700",               dot: "bg-red-500" },
  blocked:     { bg: "bg-red-50",             text: "text-red-700",               dot: "bg-red-500" },
};

interface StateBadgeProps {
  /** The state key — matched against colorMap (case-insensitive). */
  state: string;
  /** Override the display label. Defaults to the state value, title-cased. */
  label?: string;
  /** Additional color mappings or overrides. */
  colorMap?: Record<string, { bg: string; text: string; dot: string }>;
  /** Size variant. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StateBadge({ state, label, colorMap, size = "md", className }: StateBadgeProps) {
  const merged = { ...defaultColorMap, ...colorMap };
  const colors = merged[state.toLowerCase()] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  const displayLabel = label ?? state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px] gap-1",
    md: "px-2 py-0.5 text-xs gap-1.5",
    lg: "px-2.5 py-1 text-sm gap-1.5",
  };

  const dotSizes = { sm: "h-1.5 w-1.5", md: "h-2 w-2", lg: "h-2 w-2" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        colors.bg,
        colors.text,
        sizeClasses[size],
        className
      )}
    >
      <span className="relative inline-flex shrink-0">
        <span className={cn("rounded-full", colors.dot, dotSizes[size])} />
        {(state.toLowerCase() === "running" || state.toLowerCase() === "active") && (
          <span
            className={cn("absolute inset-0 rounded-full", colors.dot)}
            style={{ animation: "ping-dot 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }}
          />
        )}
      </span>
      {displayLabel}
    </span>
  );
}
