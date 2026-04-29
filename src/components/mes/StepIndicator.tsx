"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

/**
 * StepIndicator — horizontal process stage tracker for production workflows.
 *
 * Usage:
 *   <StepIndicator
 *     steps={[
 *       { label: "Planned", status: "completed" },
 *       { label: "In Progress", status: "active" },
 *       { label: "QC Check", status: "pending" },
 *       { label: "Complete", status: "pending" },
 *     ]}
 *   />
 */

type StepStatus = "completed" | "active" | "pending" | "error";

interface Step {
  label: string;
  description?: string;
  status: StepStatus;
}

interface StepIndicatorProps {
  steps: Step[];
  size?: "sm" | "default";
  className?: string;
}

const dotSize = { sm: "h-6 w-6", default: "h-8 w-8" };
const iconSize = { sm: "h-3 w-3", default: "h-3.5 w-3.5" };
const textSize = { sm: "text-[10px]", default: "text-xs" };
const descSize = { sm: "text-[9px]", default: "text-[10px]" };

export function StepIndicator({ steps, size = "default", className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-start", className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isCompleted = step.status === "completed";
        const isActive = step.status === "active";
        const isError = step.status === "error";

        return (
          <div key={i} className="flex flex-1 items-start">
            {/* Step node */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "relative flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  dotSize[size],
                  isCompleted &&
                    "border-[var(--state-running-fg)] bg-[var(--state-running-fg)]",
                  isActive &&
                    "border-[var(--state-info-fg)] bg-[var(--state-info-bg)]",
                  isError &&
                    "border-[var(--state-error-fg)] bg-[var(--state-error-fg)]",
                  !isCompleted && !isActive && !isError &&
                    "border-border bg-card",
                )}
              >
                {isCompleted && <Check className={cn(iconSize[size], "text-white")} />}
                {isError && <X className={cn(iconSize[size], "text-white")} />}
                {isActive && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-[var(--state-info-fg)]" />
                    <span
                      className="absolute inset-0 rounded-full border-2 border-[var(--state-info-fg)]"
                      style={{ animation: "ping-dot 2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
                    />
                  </>
                )}
                {!isCompleted && !isActive && !isError && (
                  <span className="size-1.5 rounded-full bg-muted-foreground" />
                )}
              </div>

              {/* Label */}
              <span className={cn("mt-1.5 text-center font-medium", textSize[size],
                isActive ? "text-foreground" : isCompleted ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
              {step.description && (
                <span className={cn("text-center text-muted-foreground", descSize[size])}>
                  {step.description}
                </span>
              )}
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="mt-3.5 flex flex-1 items-center px-2" style={size === "sm" ? { marginTop: 11 } : undefined}>
                <div
                  className={cn(
                    "h-[2px] w-full transition-colors",
                    isCompleted
                      ? "bg-[var(--state-running-fg)]"
                      : "bg-border",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
