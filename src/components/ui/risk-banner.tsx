import type { ReactNode } from "react";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RiskBanner — page-level summary of risk states in the data ("2 项物料即将
 * 过期，1 项已过期"). Render it at the top of a list/ledger page whenever the
 * dataset contains warning/error states; it carries the page's aggregate
 * signal so individual rows can stay calm (badge + accent, no red frames).
 */
export interface RiskBannerProps {
  severity: "info" | "warning" | "error";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const severityConfig = {
  info: { icon: Info, tone: "state-info" },
  warning: { icon: AlertTriangle, tone: "state-paused" },
  error: { icon: OctagonAlert, tone: "state-error" },
} as const;

export function RiskBanner({
  severity,
  children,
  action,
  className,
}: RiskBannerProps) {
  const { icon: Icon, tone } = severityConfig[severity];
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5",
        tone,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <div className="typo-body min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
