"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, X, Bell, AlertCircle, Info } from "lucide-react";

/**
 * AlarmBanner — factory alarm/alert strip for critical notifications.
 *
 * Usage:
 *   <AlarmBanner severity="critical" message="Line 3 emergency stop activated" onDismiss={() => {}} />
 *   <AlarmBanner severity="warning" message="Temperature exceeding threshold on Oven-02" timestamp="14:32:05" />
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
  /** If true, adds a subtle pulse animation to the icon. */
  pulse?: boolean;
  className?: string;
}

const severityConfig: Record<Severity, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    icon: AlertTriangle,
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
  className,
}: AlarmBannerProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 text-xs",
        config.bg,
        config.border,
        config.text,
        className
      )}
      role="alert"
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
    </div>
  );
}
