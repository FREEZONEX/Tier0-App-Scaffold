"use client";

import { cn } from "@/lib/utils";

/**
 * ProcessFlow — horizontal pipeline visualization with connected stages.
 * Shows production flow, not just status. Completely different visual shape.
 *
 * Usage:
 *   <ProcessFlow
 *     stages={[
 *       { id: "raw", label: "Raw Material", status: "completed", count: 50 },
 *       { id: "machining", label: "Machining", status: "active", count: 32 },
 *       { id: "assembly", label: "Assembly", status: "active", count: 18 },
 *       { id: "qc", label: "QC", status: "pending", count: 0 },
 *       { id: "ship", label: "Shipping", status: "pending", count: 0 },
 *     ]}
 *   />
 */

type StageStatus = "completed" | "active" | "pending" | "error";

interface Stage {
  id: string;
  label: string;
  status: StageStatus;
  /** Count of items at this stage */
  count?: number;
  /** Optional icon */
  icon?: React.ComponentType<{ className?: string }>;
}

interface ProcessFlowProps {
  stages: Stage[];
  className?: string;
}

const stageStyles: Record<StageStatus, { bg: string; border: string; text: string }> = {
  completed: {
    bg: "bg-[var(--accent)]/10",
    border: "border-[var(--accent)]",
    text: "text-[var(--accent-strong)]",
  },
  active: {
    bg: "bg-white",
    border: "border-[var(--accent)]",
    text: "text-foreground",
  },
  pending: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-muted-foreground",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
  },
};

const arrowStyles: Record<StageStatus, string> = {
  completed: "text-[var(--accent)]",
  active: "text-[var(--accent)]",
  pending: "text-gray-300",
  error: "text-red-300",
};

export function ProcessFlow({ stages, className }: ProcessFlowProps) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        const style = stageStyles[stage.status];
        const isActive = stage.status === "active";
        const Icon = stage.icon;

        return (
          <div key={stage.id} className="flex items-center gap-1">
            {/* Stage node */}
            <div
              className={cn(
                "relative flex min-w-[100px] flex-col items-center gap-1 rounded-sm border-2 px-3 py-2.5 transition-colors",
                style.bg,
                style.border,
                style.text,
                isActive && "ring-2 ring-foreground/15 ring-offset-1 ring-offset-background",
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}

              <span className="text-[11px] font-semibold text-center leading-tight">
                {stage.label}
              </span>

              {stage.count !== undefined && (
                <span className="text-lg font-bold tabular-nums leading-none">
                  {stage.count}
                </span>
              )}

              {/* Active ping */}
              {isActive && (
                <span
                  className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]"
                  style={{ animation: "ping-dot 2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
                />
              )}
            </div>

            {/* Connector */}
            {!isLast && (
              <div className="flex items-center gap-0.5 px-1">
                <svg width="32" height="12" viewBox="0 0 32 12" className="shrink-0">
                  <line
                    x1="0" y1="6" x2="24" y2="6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    className={cn(arrowStyles[stage.status])}
                    style={stage.status === "completed" || stage.status === "active"
                      ? { animation: "border-beam 1.5s linear infinite", strokeDashoffset: 0 }
                      : undefined}
                  />
                  <polygon
                    points="23,2 31,6 23,10"
                    fill="currentColor"
                    className={cn(arrowStyles[stage.status])}
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}

      {stages.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground w-full">No stages defined</div>
      )}
    </div>
  );
}
