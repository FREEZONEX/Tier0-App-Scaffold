"use client";

import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { AlertTriangle, X, AlertCircle, Info } from "lucide-react";

/**
 * AlarmBanner — factory alarm/alert strip for critical notifications.
 * Supports enter/exit animation via motion and critical glow state.
 *
 * IMPORTANT: For exit animation to work, the parent must:
 *   1. Import { AnimatePresence } from "@/lib/motion"
 *   2. Wrap with <AnimatePresence> and conditionally render the banner
 *   3. Pass a unique `key` prop on each AlarmBanner instance
 *
 * Usage:
 *   <AnimatePresence>
 *     {showAlarm && <AlarmBanner key="alarm-1" severity="critical" message="Line 3 emergency stop" onDismiss={() => setShowAlarm(false)} />}
 *   </AnimatePresence>
 */

type Severity = "critical" | "warning" | "info";

interface AlarmBannerProps {
  severity: Severity;
  message: string;
  /** Optional source identifier (machine, line, area). */
  source?: string;
  /** Optional timestamp string. */
  timestamp?: string;
  /** If provided, shows a dismiss button. */
  onDismiss?: () => void;
  /** If true, adds a pulsing glow animation (critical: red glow, warning: amber glow). */
  pulse?: boolean;
  /** Enable enter/exit animation. Default true. Set false for SSR or lists where animation would be distracting. */
  animate?: boolean;
  className?: string;
}

const severityConfig: Record<Severity, { bg: string; border: string; text: string; icon: typeof AlertTriangle; glowClass?: string }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: AlertCircle,
    glowClass: "shadow-glow-critical",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    icon: AlertTriangle,
    glowClass: "shadow-glow-warning",
  },
  info: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    icon: Info,
  },
};

export function AlarmBanner({
  severity,
  message,
  source,
  timestamp,
  onDismiss,
  pulse = false,
  animate = true,
  className,
}: AlarmBannerProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  const motionProps = animate
    ? {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
        transition: { type: "spring" as const, stiffness: 300, damping: 25 },
      }
    : {};

  return (
    <motion.div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 text-xs",
        config.bg,
        config.border,
        config.text,
        pulse && config.glowClass,
        className
      )}
      role="alert"
      style={pulse && severity === "critical" ? { animation: "pulse-glow-critical 2s ease-in-out infinite" } : undefined}
      {...motionProps}
    >
      <Icon className={cn("h-4 w-4 shrink-0", pulse && "animate-pulse")} />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {source && (
          <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-medium">
            {source}
          </span>
        )}
        <span className="truncate">{message}</span>
      </div>

      {timestamp && (
        <span className="shrink-0 tabular-nums text-[10px] opacity-60">
          {timestamp}
        </span>
      )}

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-black/5"
          aria-label="Dismiss alarm"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}
