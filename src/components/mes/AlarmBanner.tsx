"use client";

import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { AlertTriangle, X, AlertOctagon, Info } from "lucide-react";

/**
 * AlarmBanner — factory alarm strip for critical notifications.
 *
 * Industrial treatment:
 *   - critical: solid red bar, white text, optional pulse — draws eye
 *   - warning:  amber tinted background, dark text — visible but secondary
 *   - info:     neutral bordered, used for status announcements
 *
 * Each severity has a distinct icon (octagon / triangle / circle) so the
 * meaning survives color blindness and monochrome reproduction.
 *
 * Optional enter/exit animation requires the parent to:
 *   1. Import { AnimatePresence } from "@/lib/motion"
 *   2. Wrap with <AnimatePresence> and conditionally render the banner
 *   3. Pass a unique `key` prop on each AlarmBanner instance
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
  /** Pulse for critical alarms. Default false — use for *real* critical events. */
  pulse?: boolean;
  /** Enable enter/exit animation. Default true. */
  animate?: boolean;
  className?: string;
}

const severityConfig: Record<
  Severity,
  {
    container: string;
    icon: typeof AlertTriangle;
    iconColor: string;
    sourceBg: string;
    timestamp: string;
  }
> = {
  critical: {
    container: "bg-[var(--state-error-fg)] text-white border-[var(--state-error-fg)]",
    icon: AlertOctagon,
    iconColor: "text-white",
    sourceBg: "bg-white/15",
    timestamp: "text-white/70",
  },
  warning: {
    container:
      "bg-[var(--state-paused-bg)] text-[var(--state-paused-fg)] border-[var(--state-paused-border)]",
    icon: AlertTriangle,
    iconColor: "text-[var(--state-paused-fg)]",
    sourceBg: "bg-black/5",
    timestamp: "text-[var(--state-paused-fg)]/70",
  },
  info: {
    container:
      "bg-[var(--state-info-bg)] text-[var(--state-info-fg)] border-[var(--state-info-border)]",
    icon: Info,
    iconColor: "text-[var(--state-info-fg)]",
    sourceBg: "bg-black/5",
    timestamp: "text-[var(--state-info-fg)]/70",
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
        initial: { opacity: 0, y: -4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
        transition: { duration: 0.18, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
      }
    : {};

  return (
    <motion.div
      role="alert"
      className={cn(
        "flex items-center gap-2.5 rounded-sm border px-3 py-2 text-xs font-medium",
        config.container,
        className,
      )}
      style={
        pulse && severity === "critical"
          ? { animation: "pulse-critical 1.6s ease-in-out infinite" }
          : undefined
      }
      {...motionProps}
    >
      <Icon className={cn("size-4 shrink-0", config.iconColor)} aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {source && (
          <span
            className={cn(
              "shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
              config.sourceBg,
            )}
          >
            {source}
          </span>
        )}
        <span className="truncate">{message}</span>
      </div>

      {timestamp && (
        <span
          className={cn(
            "shrink-0 font-mono tabular-nums text-[10px]",
            config.timestamp,
          )}
        >
          {timestamp}
        </span>
      )}

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-sm p-0.5 transition-colors hover:bg-black/10"
          aria-label="Dismiss alarm"
        >
          <X className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}
