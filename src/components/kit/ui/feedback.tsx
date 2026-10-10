"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Empty                                                               */
/* ------------------------------------------------------------------ */

function EmptyInbox({ small }: { small: boolean }) {
  return (
    <svg
      width={small ? 48 : 64}
      height={small ? 31 : 41}
      viewBox="0 0 64 41"
      aria-hidden="true"
      className="text-[#d9d9d9]"
    >
      <g transform="translate(0 1)" fill="none" fillRule="evenodd">
        <ellipse fill="#f5f5f5" cx="32" cy="33" rx="32" ry="7" />
        <g fillRule="nonzero" stroke="currentColor">
          <path d="M55 12.76 44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z" />
          <path
            d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z"
            fill="#fafafa"
          />
        </g>
      </g>
    </svg>
  );
}

export interface EmptyProps {
  /** Default 「暂无数据」. */
  description?: ReactNode;
  /** Custom illustration / icon; `null` hides it. */
  image?: ReactNode;
  size?: "sm" | "md";
  /** Actions under the description (a real create button, a link…). */
  children?: ReactNode;
  className?: string;
}

export function Empty({ description = "暂无数据", image, size = "md", children, className }: EmptyProps) {
  const small = size === "sm";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        small ? "gap-1.5 px-3 py-4" : "gap-2 px-4 py-8",
        className,
      )}
    >
      {image === null ? null : (
        <div className="text-text-placeholder [&>svg:not([width])]:size-10">
          {image ?? <EmptyInbox small={small} />}
        </div>
      )}
      {description ? (
        <div className={cn("text-text-tertiary", small ? "text-xs leading-5" : "text-sm leading-[22px]")}>
          {description}
        </div>
      ) : null}
      {children ? <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spin / Skeleton                                                     */
/* ------------------------------------------------------------------ */

const SPINNER_SIZE = { sm: "size-3.5 border-2", md: "size-5 border-2", lg: "size-8 border-[3px]" } as const;

export interface SpinProps {
  spinning?: boolean;
  size?: "sm" | "md" | "lg";
  tip?: ReactNode;
  /** Wrap content: keeps it visible under a translucent veil while spinning. */
  children?: ReactNode;
  className?: string;
}

function Spinner({ size }: { size: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-brand border-r-transparent",
        SPINNER_SIZE[size],
      )}
    />
  );
}

export function Spin({ spinning = true, size = "md", tip, children, className }: SpinProps) {
  if (children === undefined) {
    if (!spinning) return null;
    return (
      <span
        role="status"
        aria-live="polite"
        className={cn("inline-flex flex-col items-center justify-center gap-2 text-brand", className)}
      >
        <Spinner size={size} />
        {tip ? <span className="text-sm text-brand">{tip}</span> : <span className="sr-only">加载中</span>}
      </span>
    );
  }
  return (
    <div className={cn("relative min-w-0", className)} aria-busy={spinning || undefined}>
      <div className={cn("transition-opacity duration-200", spinning && "pointer-events-none opacity-50")}>
        {children}
      </div>
      {spinning ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2"
        >
          <Spinner size={size} />
          {tip ? <span className="text-sm text-brand">{tip}</span> : <span className="sr-only">加载中</span>}
        </div>
      ) : null}
    </div>
  );
}

const SKELETON_BAR =
  "rounded-sm bg-[linear-gradient(90deg,#f2f2f2_25%,#e6e6e6_37%,#f2f2f2_63%)] bg-[length:400%_100%]";

export interface SkeletonProps {
  rows?: number;
  title?: boolean;
  avatar?: boolean;
  active?: boolean;
  className?: string;
}

export function Skeleton({ rows = 3, title = true, avatar = false, active = true, className }: SkeletonProps) {
  return (
    <div className={cn("flex w-full gap-4", className)} aria-busy="true" aria-live="polite">
      {avatar ? (
        <div className={cn("size-10 shrink-0 rounded-full", SKELETON_BAR, active && "animate-lingo-shimmer")} />
      ) : null}
      <div className="min-w-0 flex-1 space-y-3 pt-1">
        {title ? <div className={cn("h-4 w-2/5", SKELETON_BAR, active && "animate-lingo-shimmer")} /> : null}
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className={cn(
              "h-4",
              index === rows - 1 && rows > 1 ? "w-3/5" : "w-full",
              SKELETON_BAR,
              active && "animate-lingo-shimmer",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Placeholder for a list table while the first page loads. */
export function TableSkeleton({ rows = 6, columns = 6, className }: TableSkeletonProps) {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg", className)} aria-busy="true" aria-live="polite">
      <div className="flex h-11 items-center gap-6 bg-card px-3">
        {Array.from({ length: columns }, (_, index) => (
          <div key={index} className="h-3.5 flex-1 rounded-sm bg-[#e8e8e8]" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-12 items-center gap-6 border-b border-border-secondary px-3">
          {Array.from({ length: columns }, (_, column) => (
            <div
              key={column}
              className={cn("h-3.5 flex-1", SKELETON_BAR, "animate-lingo-shimmer")}
              style={{ maxWidth: `${60 + ((row + column * 3) % 4) * 10}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export type ProgressStatus = "normal" | "active" | "success" | "exception";

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

/** "52.5%" — at most two decimals, trailing zeros trimmed. */
function percentText(percent: number): string {
  return `${Number(clampPercent(percent).toFixed(2))}%`;
}

function progressColor(percent: number, status: ProgressStatus | undefined, strokeColor?: string): string {
  if (strokeColor) return strokeColor;
  if (status === "exception") return "var(--tier0-error-color)";
  if (status === "success" || (status !== "active" && clampPercent(percent) >= 100)) {
    return "var(--tier0-success-color)";
  }
  return "var(--tier0-primary)";
}

export interface ProgressBarProps {
  /** 0–100 */
  percent: number;
  status?: ProgressStatus;
  showInfo?: boolean;
  size?: "sm" | "md";
  strokeColor?: string;
  trailColor?: string;
  format?: (percent: number) => ReactNode;
  className?: string;
}

export function ProgressBar({
  percent,
  status,
  showInfo = true,
  size = "md",
  strokeColor,
  trailColor = "#f0f0f0",
  format,
  className,
}: ProgressBarProps) {
  const value = clampPercent(percent);
  const color = progressColor(value, status, strokeColor);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(value.toFixed(2))}
      className={cn("flex w-full min-w-0 items-center gap-2", className)}
    >
      <div
        className={cn("relative min-w-0 flex-1 overflow-hidden rounded-full", size === "sm" ? "h-1" : "h-1.5")}
        style={{ backgroundColor: trailColor }}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
            status === "active" && "animate-pulse",
          )}
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      {showInfo ? (
        <span
          className={cn(
            "shrink-0 text-right tabular-nums text-text-secondary",
            size === "sm" ? "min-w-9 text-xs" : "min-w-10 text-sm",
          )}
        >
          {format ? format(value) : percentText(value)}
        </span>
      ) : null}
    </div>
  );
}

export interface ProgressRingProps {
  /** 0–100 */
  percent: number;
  /** Diameter in px (default 28). */
  size?: number;
  strokeWidth?: number;
  status?: ProgressStatus;
  showInfo?: boolean;
  strokeColor?: string;
  trailColor?: string;
  format?: (percent: number) => ReactNode;
  title?: string;
  className?: string;
}

/** ProgressRing — small circular progress (工序进度链 nodes). */
export function ProgressRing({
  percent,
  size = 28,
  strokeWidth = 2.5,
  status,
  showInfo = true,
  strokeColor,
  trailColor = "#e8e8e8",
  format,
  title,
  className,
}: ProgressRingProps) {
  const value = clampPercent(percent);
  const color = progressColor(value, status, strokeColor);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fontSize = Math.max(8, Math.round(size * 0.3));
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(value.toFixed(2))}
      title={title}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="#fff" stroke={trailColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={value > 0 && value < 100 ? "round" : "butt"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      {showInfo ? (
        <span
          className="absolute inset-0 flex items-center justify-center font-medium tabular-nums leading-none text-text-secondary"
          style={{ fontSize, color: value >= 100 && !strokeColor ? "var(--tier0-success-deep)" : undefined }}
        >
          {format ? format(value) : `${Math.round(value)}%`}
        </span>
      ) : null}
    </span>
  );
}
