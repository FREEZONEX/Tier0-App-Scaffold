#!/usr/bin/env python3
"""Print app-local MES UI starter snippets.

These are templates, not a component library. Copy only the snippet needed for
the current app and adapt props, names, copy, and data fields.
"""

from __future__ import annotations

import argparse
import textwrap


GROUP_ORDER = [
    "Foundation",
    "Execution Flow",
    "Scheduling",
    "Quality Analysis",
    "History & Review",
    "Fleet & Monitoring",
]

SNIPPET_META: dict[str, tuple[str, str]] = {
    "toolbar": ("Foundation", "Workspace filter and action row."),
    "metric-card": ("Foundation", "Compact KPI tile for counts, rates, and totals."),
    "summary-strip": ("Foundation", "Dense top-of-page KPI strip for compact operational summaries."),
    "state-badge": ("Foundation", "Operational status pill with icon and semantic tone."),
    "chart-panel": ("Foundation", "ClientOnly chart wrapper with fixed-height panel."),
    "process-flow": ("Execution Flow", "Stage-by-stage manufacturing route or process flow."),
    "step-indicator": ("Execution Flow", "Compact local progress indicator for short task steps."),
    "target-bar": ("Execution Flow", "Actual-versus-target comparison with explicit numbers."),
    "shift-bar": ("Scheduling", "Shift coverage, occupancy band, or handover window bar."),
    "gantt-board": ("Scheduling", "Resource-by-time scheduling board with positioned bars."),
    "spc-chart": ("Quality Analysis", "Control chart with CL/UCL/LCL references."),
    "pareto-chart": ("Quality Analysis", "Ranked causes with cumulative percentage line."),
    "timeline": ("History & Review", "Chronological event, audit, genealogy, or approval stream."),
    "kanban-board": ("History & Review", "Queue-by-status board with optional drag and drop."),
    "leaderboard": ("History & Review", "Ranked list for losses, defects, downtime, or comparisons."),
    "heatmap-grid": ("Fleet & Monitoring", "Matrix of resource or shift intensity cells."),
    "fleet-grid": ("Fleet & Monitoring", "Dense equipment or workstation status tile grid."),
    "oee-gauge": ("Fleet & Monitoring", "Multi-ring OEE summary gauge."),
    "alarm-banner": ("Fleet & Monitoring", "High-priority alert strip with action and dismiss path."),
}


SNIPPETS: dict[str, str] = {
    "toolbar": r'''
import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DomainToolbar({
  className,
  children,
  right,
  ...props
}: HTMLAttributes<HTMLDivElement> & { right?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-sm border border-border bg-card px-3 py-3 md:flex-row md:items-center md:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}
''',
    "metric-card": r'''
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const metricTone: Record<string, string> = {
  neutral: "border-border bg-surface-inset text-foreground",
  info: "border-state-info-border bg-state-info-bg text-state-info-fg",
  running: "border-state-running-border bg-state-running-bg text-state-running-fg",
  risk: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
  error: "border-state-error-border bg-state-error-bg text-state-error-fg",
  highlight: "border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground",
};

export function MetricCard({
  label,
  value,
  unit,
  trend,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: LucideIcon;
  tone?: "neutral" | "info" | "running" | "risk" | "error" | "highlight" | string;
  className?: string;
}) {
  const TrendIcon = trend && trend < 0 ? TrendingDown : TrendingUp;
  const toneClassName = metricTone[tone] ?? metricTone.neutral;
  return (
    <section className={cn("rounded-sm border px-3 py-2.5", toneClassName, className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium uppercase leading-4 tracking-[0.04em] opacity-75">
          {label}
        </p>
        {Icon ? <Icon className="size-3.5 shrink-0 opacity-75" /> : null}
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0 flex items-baseline gap-1.5 font-mono">
          <span className="truncate text-3xl font-semibold leading-none tabular-nums">{value}</span>
          {unit ? <span className="pb-0.5 text-xs opacity-75">{unit}</span> : null}
        </div>
        {trend !== undefined ? (
          <div className="mb-0.5 flex shrink-0 items-center gap-1 text-xs opacity-80">
            <TrendIcon className="size-3.5" />
            <span className="font-mono tabular-nums">{Math.abs(trend).toFixed(1)}%</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
''',
    "summary-strip": r'''
import { cn } from "@/lib/utils";

export interface SummaryStripItem {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  tone?: "neutral" | "running" | "risk" | "error" | "info";
}

const toneClass: Record<NonNullable<SummaryStripItem["tone"]>, string> = {
  neutral: "border-border bg-surface-inset text-foreground",
  running: "border-state-running-border bg-state-running-bg text-state-running-fg",
  risk: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
  error: "border-state-error-border bg-state-error-bg text-state-error-fg",
  info: "border-state-info-border bg-state-info-bg text-state-info-fg",
};

export function SummaryStrip({
  items,
  className,
}: {
  items: SummaryStripItem[];
  className?: string;
}) {
  return (
    <section className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className={cn("rounded-sm border px-3 py-2.5", toneClass[item.tone ?? "neutral"])}
        >
          <p className="truncate text-xs opacity-80">{item.label}</p>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-semibold leading-none tabular-nums">{item.value}</span>
            {item.unit ? <span className="text-xs opacity-75">{item.unit}</span> : null}
          </div>
        </div>
      ))}
    </section>
  );
}
''',
    "spc-chart": r'''
import { ClientOnly } from "@/components/client-only";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SpcPoint {
  id: string;
  label: string;
  value: number;
  ucl?: number;
  cl?: number;
  lcl?: number;
}

function formatSpcValue(value: number, unit?: string) {
  return `${value.toLocaleString()}${unit ?? ""}`;
}

export function SpcChart({
  data,
  title = "Process Control",
  unit,
  className,
}: {
  data: SpcPoint[];
  title?: string;
  unit?: string;
  className?: string;
}) {
  const limitSource = data.find(
    (point) => point.ucl !== undefined || point.cl !== undefined || point.lcl !== undefined,
  );

  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">
            Latest {data.length} samples
          </p>
        </div>
        {data.length > 0 ? (
          <p className="font-mono text-sm font-medium tabular-nums text-foreground">
            {formatSpcValue(data[data.length - 1]?.value ?? 0, unit)}
          </p>
        ) : null}
      </div>
      <div className="h-72 min-w-0">
        <ClientOnly fallback={<div className="h-full rounded-sm border border-border bg-surface-inset" />}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={44} />
              <Tooltip
                formatter={(value: number) => [formatSpcValue(Number(value), unit), "Measured Value"]}
                labelFormatter={(label) => `Sample ${label}`}
              />
              {limitSource?.ucl !== undefined ? (
                <ReferenceLine
                  y={limitSource.ucl}
                  stroke="var(--state-error-fg)"
                  strokeDasharray="4 4"
                  label={{ value: "UCL", position: "insideTopRight", fill: "var(--state-error-fg)", fontSize: 11 }}
                />
              ) : null}
              {limitSource?.cl !== undefined ? (
                <ReferenceLine
                  y={limitSource.cl}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="2 2"
                  label={{ value: "CL", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
                />
              ) : null}
              {limitSource?.lcl !== undefined ? (
                <ReferenceLine
                  y={limitSource.lcl}
                  stroke="var(--state-info-fg)"
                  strokeDasharray="4 4"
                  label={{ value: "LCL", position: "insideBottomRight", fill: "var(--state-info-fg)", fontSize: 11 }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--tier0-primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--tier0-primary)" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ClientOnly>
      </div>
    </section>
  );
}
''',
    "pareto-chart": r'''
import { ClientOnly } from "@/components/client-only";
import { cn } from "@/lib/utils";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ParetoItem {
  id: string;
  label: string;
  value: number;
}

export function ParetoChart({
  items,
  title = "Pareto Analysis",
  unit,
  className,
}: {
  items: ParetoItem[];
  title?: string;
  unit?: string;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let running = 0;
  const data = items.map((item) => {
    running += item.value;
    return {
      ...item,
      cumulative: total > 0 ? Math.round((running / total) * 1000) / 10 : 0,
    };
  });

  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">Total {total.toLocaleString()}{unit ?? ""}</p>
        </div>
        {data.length > 0 ? (
          <p className="text-xs text-muted-foreground">Sorted by quantity, highest to lowest</p>
        ) : null}
      </div>
      <div className="h-72 min-w-0">
        <ClientOnly fallback={<div className="h-full rounded-sm border border-border bg-surface-inset" />}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={data.length > 5 ? -20 : 0}
                textAnchor={data.length > 5 ? "end" : "middle"}
                height={data.length > 5 ? 56 : 32}
              />
              <YAxis yAxisId="count" tick={{ fontSize: 11 }} width={44} />
              <YAxis
                yAxisId="percent"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
                width={44}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "cumulative"
                    ? [`${Number(value).toFixed(1)}%`, "Cumulative Share"]
                    : [`${Number(value).toLocaleString()}${unit ?? ""}`, "Count"]
                }
              />
              <Bar
                yAxisId="count"
                dataKey="value"
                fill="var(--tier0-primary)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="cumulative"
                stroke="var(--tier0-highlight)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--tier0-highlight)" }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ClientOnly>
      </div>
    </section>
  );
}
''',
    "state-badge": r'''
import { CheckCircle2, Circle, Pause, Play, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const states: Record<string, { className: string; icon: LucideIcon; live?: boolean }> = {
  running: { className: "state-running", icon: Play, live: true },
  completed: { className: "state-running", icon: CheckCircle2 },
  idle: { className: "state-idle", icon: Circle },
  pending: { className: "state-idle", icon: Circle },
  paused: { className: "state-paused", icon: Pause },
  warning: { className: "state-paused", icon: TriangleAlert },
  failed: { className: "state-error", icon: XCircle },
  blocked: { className: "state-error", icon: XCircle },
};

export function StateBadge({
  state,
  label = state,
  className,
}: {
  state: string;
  label?: string;
  className?: string;
}) {
  const config = states[state.toLowerCase()] ?? states.pending;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium", config.className, className)}>
      <span className="relative inline-flex items-center justify-center">
        <Icon className="size-3.5" aria-hidden />
        {config.live ? <span className="absolute size-2 rounded-full border-2 border-current animate-ping" aria-hidden /> : null}
      </span>
      <span>{label}</span>
    </span>
  );
}
''',
    "timeline": r'''
import { CircleAlert, CircleCheck, Clock, Play, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const timelineStates: Record<string, { icon: LucideIcon; badgeClassName: string; iconClassName: string; label: string }> = {
  completed: {
    icon: CircleCheck,
    badgeClassName: "border-state-running-border bg-state-running-bg text-state-running-fg",
    iconClassName: "border-state-running-border bg-state-running-bg text-state-running-fg",
    label: "Completed",
  },
  running: {
    icon: Play,
    badgeClassName: "border-state-info-border bg-state-info-bg text-state-info-fg",
    iconClassName: "border-state-info-border bg-state-info-bg text-state-info-fg",
    label: "In Progress",
  },
  pending: {
    icon: Clock,
    badgeClassName: "border-border bg-background text-muted-foreground",
    iconClassName: "border-border bg-background text-muted-foreground",
    label: "Pending",
  },
  warning: {
    icon: CircleAlert,
    badgeClassName: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
    iconClassName: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
    label: "Exception",
  },
  failed: {
    icon: CircleAlert,
    badgeClassName: "border-state-error-border bg-state-error-bg text-state-error-fg",
    iconClassName: "border-state-error-border bg-state-error-bg text-state-error-fg",
    label: "Failed",
  },
};

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  detail?: string;
  actor?: string;
  state?: "completed" | "running" | "pending" | "warning" | "failed" | string;
  stateLabel?: string;
}

export function EventTimeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) {
  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      {events.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-surface-inset px-3 py-8 text-center text-sm text-muted-foreground">
          No events recorded
        </div>
      ) : (
        <div className="space-y-0">
          {events.map((event, index) => {
            const state = timelineStates[event.state?.toLowerCase() ?? "pending"] ?? timelineStates.pending;
            const Icon = state.icon;
            return (
              <article
                key={event.id}
                className={cn(
                  "grid grid-cols-[4.75rem_1.25rem_minmax(0,1fr)] gap-3 pb-4",
                  index === events.length - 1 && "pb-0",
                )}
              >
                <div className="pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {event.time}
                </div>
                <div className="relative flex justify-center">
                  {index < events.length - 1 ? (
                    <span className="absolute top-5 bottom-[-1rem] w-px bg-border" aria-hidden />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 inline-flex size-5 items-center justify-center rounded-full border",
                      state.iconClassName,
                    )}
                  >
                    <Icon className="size-3" aria-hidden />
                  </span>
                </div>
                <div className="min-w-0 rounded-sm border border-border bg-surface-inset px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground">
                      {event.title}
                    </p>
                    <span className={cn("inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-medium leading-none", state.badgeClassName)}>
                      {event.stateLabel ?? state.label}
                    </span>
                  </div>
                  {event.detail ? (
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{event.detail}</p>
                  ) : null}
                  {event.actor ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="size-3.5" aria-hidden />
                      <span className="truncate">{event.actor}</span>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
''',
    "process-flow": r'''
import { CheckCircle2, CircleAlert, Clock3, Play, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const processStates: Record<string, { icon: LucideIcon; iconClassName: string; connectorClassName: string; label: string }> = {
  completed: {
    icon: CheckCircle2,
    iconClassName: "border-state-running-border bg-state-running-bg text-state-running-fg",
    connectorClassName: "bg-state-running-border",
    label: "Completed",
  },
  running: {
    icon: Play,
    iconClassName: "border-state-info-border bg-state-info-bg text-state-info-fg",
    connectorClassName: "bg-state-info-border",
    label: "In Progress",
  },
  pending: {
    icon: Clock3,
    iconClassName: "border-border bg-background text-muted-foreground",
    connectorClassName: "bg-border",
    label: "Pending",
  },
  warning: {
    icon: CircleAlert,
    iconClassName: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
    connectorClassName: "bg-state-paused-border",
    label: "Exception",
  },
  failed: {
    icon: CircleAlert,
    iconClassName: "border-state-error-border bg-state-error-bg text-state-error-fg",
    connectorClassName: "bg-state-error-border",
    label: "Failed",
  },
};

export interface ProcessStage {
  id: string;
  label: string;
  detail?: string;
  state?: "completed" | "running" | "pending" | "warning" | "failed" | string;
  stateLabel?: string;
}

export function ProcessFlow({
  stages,
  className,
}: {
  stages: ProcessStage[];
  className?: string;
}) {
  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      <div className="flex overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const state = processStates[stage.state?.toLowerCase() ?? "pending"] ?? processStates.pending;
          const Icon = state.icon;
          return (
            <div key={stage.id} className="flex min-w-[11rem] items-start">
              <div className="flex min-w-0 flex-1 gap-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
                    state.iconClassName,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{stage.label}</p>
                    <span className="text-xs text-muted-foreground">{stage.stateLabel ?? state.label}</span>
                  </div>
                  {stage.detail ? (
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{stage.detail}</p>
                  ) : null}
                </div>
              </div>
              {index < stages.length - 1 ? (
                <span
                  className={cn("mx-3 mt-4 h-px min-w-8 shrink-0 rounded-full", state.connectorClassName)}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
''',
    "step-indicator": r'''
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const stepStates: Record<string, { badgeClassName: string; circleClassName: string; label: string }> = {
  completed: {
    badgeClassName: "text-state-running-fg",
    circleClassName: "border-state-running-border bg-state-running-bg text-state-running-fg",
    label: "Completed",
  },
  current: {
    badgeClassName: "text-state-info-fg",
    circleClassName: "border-state-info-border bg-state-info-bg text-state-info-fg",
    label: "Current",
  },
  upcoming: {
    badgeClassName: "text-muted-foreground",
    circleClassName: "border-border bg-background text-muted-foreground",
    label: "Not Started",
  },
  failed: {
    badgeClassName: "text-state-error-fg",
    circleClassName: "border-state-error-border bg-state-error-bg text-state-error-fg",
    label: "Exception",
  },
};

export interface StepItem {
  id: string;
  label: string;
  description?: string;
  state?: "completed" | "current" | "upcoming" | "failed" | string;
}

export function StepIndicator({
  steps,
  className,
}: {
  steps: StepItem[];
  className?: string;
}) {
  return (
    <nav className={cn("rounded-sm border border-border bg-card p-3", className)} aria-label="Process steps">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const state = stepStates[step.state?.toLowerCase() ?? "upcoming"] ?? stepStates.upcoming;
          const isCompleted = (step.state?.toLowerCase() ?? "") === "completed";
          return (
            <li
              key={step.id}
              className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-sm border border-border bg-surface-inset px-3 py-2"
            >
              <span
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  state.circleClassName,
                )}
              >
                {isCompleted ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{step.label}</span>
                <span className={cn("block truncate text-xs", state.badgeClassName)}>
                  {step.description ?? state.label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
''',
    "target-bar": r'''
import { cn } from "@/lib/utils";

export function TargetBar({
  label,
  actual,
  target,
  unit,
  className,
}: {
  label: string;
  actual: number;
  target: number;
  unit?: string;
  className?: string;
}) {
  const safeTarget = target > 0 ? target : 0;
  const ratio = safeTarget > 0 ? actual / safeTarget : 0;
  const cappedWidth = `${Math.max(0, Math.min(ratio, 1)) * 100}%`;
  const statusClassName =
    ratio >= 1 ? "bg-state-running-fg" : ratio >= 0.85 ? "bg-highlight-bg-accent" : "bg-state-paused-fg";

  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Actual {actual.toLocaleString()}
            {unit ? unit : ""}
            {" / "}Target {target.toLocaleString()}
            {unit ? unit : ""}
          </p>
        </div>
        <p className="font-mono text-sm font-medium tabular-nums text-foreground">
          {safeTarget > 0 ? `${Math.round(ratio * 100)}%` : "--"}
        </p>
      </div>
      <div className="mt-3">
        <div className="relative h-3 rounded-full border border-border bg-surface-inset">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", statusClassName)}
            style={{ width: cappedWidth }}
          />
          <span className="absolute -top-1.5 bottom-[-0.375rem] right-0 w-px bg-foreground/70" aria-hidden />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>0</span>
          <span>Target</span>
        </div>
      </div>
    </section>
  );
}
''',
    "shift-bar": r'''
import { cn } from "@/lib/utils";

const shiftTones: Record<string, string> = {
  highlight: "border-highlight-bg-primary bg-button-highlight text-accent-foreground",
  running: "border-state-running-border bg-state-running-bg text-state-running-fg",
  info: "border-state-info-border bg-state-info-bg text-state-info-fg",
  paused: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
  neutral: "border-border bg-background text-foreground",
};

export interface ShiftSegment {
  id: string;
  label: string;
  startMinute: number;
  endMinute: number;
  tone?: "highlight" | "running" | "info" | "paused" | "neutral" | string;
  meta?: string;
}

function formatMinuteLabel(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ShiftBar({
  segments,
  rangeStart = 0,
  rangeEnd = 24 * 60,
  currentMinute,
  className,
}: {
  segments: ShiftSegment[];
  rangeStart?: number;
  rangeEnd?: number;
  currentMinute?: number;
  className?: string;
}) {
  const totalRange = Math.max(rangeEnd - rangeStart, 1);

  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{formatMinuteLabel(rangeStart)}</span>
        <span>{formatMinuteLabel(rangeEnd)}</span>
      </div>
      <div className="relative mt-3 h-14 rounded-sm border border-border bg-surface-inset">
        {segments.map((segment) => {
          const left = ((segment.startMinute - rangeStart) / totalRange) * 100;
          const width = ((segment.endMinute - segment.startMinute) / totalRange) * 100;
          return (
            <div
              key={segment.id}
              title={`${segment.label} ${formatMinuteLabel(segment.startMinute)}-${formatMinuteLabel(segment.endMinute)}`}
              className={cn(
                "absolute top-2 bottom-2 overflow-hidden rounded-sm border px-2 py-1",
                shiftTones[segment.tone ?? "neutral"] ?? shiftTones.neutral,
              )}
              style={{
                left: `${Math.max(left, 0)}%`,
                width: `${Math.max(width, 4)}%`,
              }}
            >
              <p className="truncate text-xs font-medium">{segment.label}</p>
              {segment.meta ? <p className="truncate text-[11px] opacity-80">{segment.meta}</p> : null}
            </div>
          );
        })}
        {currentMinute !== undefined ? (
          <span
            className="absolute top-0 bottom-0 w-px bg-foreground/80"
            style={{ left: `${((currentMinute - rangeStart) / totalRange) * 100}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      {currentMinute !== undefined ? (
        <p className="mt-2 text-xs text-muted-foreground">Current time {formatMinuteLabel(currentMinute)}</p>
      ) : null}
    </section>
  );
}
''',
    "heatmap-grid": r'''
import { Fragment } from "react";
import { cn } from "@/lib/utils";

function toneByIntensity(intensity: number) {
  if (intensity >= 0.75) {
    return "border-highlight-bg-primary bg-button-highlight text-accent-foreground";
  }
  if (intensity >= 0.45) {
    return "border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground";
  }
  if (intensity >= 0.15) {
    return "border-border bg-surface-inset text-foreground";
  }
  return "border-border bg-background text-muted-foreground";
}

export interface HeatmapRow {
  label: string;
  cells: Array<{
    id: string;
    value: string | number;
    intensity: number;
    title?: string;
  }>;
}

export function HeatmapGrid({
  columns,
  rows,
  className,
}: {
  columns: string[];
  rows: HeatmapRow[];
  className?: string;
}) {
  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[40rem] gap-2"
          style={{ gridTemplateColumns: `7rem repeat(${columns.length}, minmax(3.5rem, 1fr))` }}
        >
          <div />
          {columns.map((column) => (
            <div
              key={column}
              className="px-1 text-center text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground"
            >
              {column}
            </div>
          ))}
          {rows.map((row) => (
            <Fragment key={row.label}>
              <div className="flex items-center pr-2 text-sm font-medium text-foreground">{row.label}</div>
              {row.cells.map((cell, index) => (
                <div
                  key={cell.id}
                  title={cell.title ?? `${row.label} / ${columns[index] ?? ""}: ${cell.value}`}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-sm border text-sm font-medium tabular-nums",
                    toneByIntensity(Math.max(0, Math.min(cell.intensity, 1))),
                  )}
                >
                  {cell.value}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
''',
    "fleet-grid": r'''
import { Activity, CircleAlert, Cpu, Pause, Play, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const fleetStates: Record<string, { icon: LucideIcon; badgeClassName: string; label: string }> = {
  running: {
    icon: Play,
    badgeClassName: "border-state-running-border bg-state-running-bg text-state-running-fg",
    label: "Running",
  },
  idle: {
    icon: Activity,
    badgeClassName: "border-border bg-background text-muted-foreground",
    label: "Idle",
  },
  paused: {
    icon: Pause,
    badgeClassName: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
    label: "Paused",
  },
  warning: {
    icon: CircleAlert,
    badgeClassName: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
    label: "Warning",
  },
  failed: {
    icon: CircleAlert,
    badgeClassName: "border-state-error-border bg-state-error-bg text-state-error-fg",
    label: "Fault",
  },
};

export interface FleetAsset {
  id: string;
  name: string;
  secondary?: string;
  state?: "running" | "idle" | "paused" | "warning" | "failed" | string;
  stateLabel?: string;
  metrics?: Array<{ label: string; value: string | number }>;
  alert?: string;
}

export function FleetGrid({
  assets,
  className,
}: {
  assets: FleetAsset[];
  className?: string;
}) {
  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      {assets.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-surface-inset px-3 py-8 text-center text-sm text-muted-foreground">
          No equipment
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const state = fleetStates[asset.state?.toLowerCase() ?? "idle"] ?? fleetStates.idle;
            const StateIcon = state.icon;
            return (
              <article key={asset.id} className="rounded-sm border border-border bg-surface-inset p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground">
                      <Cpu className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
                      {asset.secondary ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{asset.secondary}</p>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium leading-none",
                      state.badgeClassName,
                    )}
                  >
                    <StateIcon className="size-3" aria-hidden />
                    {asset.stateLabel ?? state.label}
                  </span>
                </div>
                {asset.metrics?.length ? (
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    {asset.metrics.slice(0, 4).map((metric) => (
                      <div key={metric.label} className="rounded-sm border border-border bg-background px-2 py-2">
                        <dt className="text-[11px] text-muted-foreground">{metric.label}</dt>
                        <dd className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
                          {metric.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {asset.alert ? (
                  <div className="mt-3 rounded-sm border border-state-paused-border bg-state-paused-bg px-2.5 py-2 text-xs text-state-paused-fg">
                    {asset.alert}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
''',
    "kanban-board": r'''
import { type ButtonHTMLAttributes } from "react";
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { cn } from "@/lib/utils";

const columnTones: Record<string, string> = {
  neutral: "border-border bg-surface-inset",
  info: "border-state-info-border bg-state-info-bg/35",
  running: "border-state-running-border bg-state-running-bg/45",
  paused: "border-state-paused-border bg-state-paused-bg/45",
  error: "border-state-error-border bg-state-error-bg/45",
};

export interface KanbanCardItem {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  tone?: "neutral" | "info" | "running" | "paused" | "error" | string;
  items: KanbanCardItem[];
}

export function KanbanBoard({
  columns,
  className,
}: {
  columns: KanbanColumn[];
  className?: string;
}) {
  return (
    <ClientOnly fallback={<KanbanBoardStatic columns={columns} className={className} />}>
      <InteractiveKanbanBoard initialColumns={columns} className={className} />
    </ClientOnly>
  );
}

function InteractiveKanbanBoard({
  initialColumns,
  className,
}: {
  initialColumns: KanbanColumn[];
  className?: string;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeColumnId = active.data.current?.columnId as string | undefined;
    const overColumnId =
      (over.data.current?.columnId as string | undefined) ??
      (over.data.current?.type === "column" ? overId : undefined);

    if (!activeColumnId || !overColumnId) return;

    setColumns((current) => {
      const sourceColumn = current.find((column) => column.id === activeColumnId);
      const targetColumn = current.find((column) => column.id === overColumnId);
      if (!sourceColumn || !targetColumn) return current;

      const sourceItems = [...sourceColumn.items];
      const targetItems =
        activeColumnId === overColumnId ? sourceItems : [...targetColumn.items];

      const sourceIndex = sourceItems.findIndex((item) => item.id === activeId);
      if (sourceIndex === -1) return current;

      const [movedItem] = sourceItems.splice(sourceIndex, 1);

      let targetIndex =
        over.data.current?.type === "column"
          ? targetItems.length
          : targetItems.findIndex((item) => item.id === overId);

      if (targetIndex < 0) targetIndex = targetItems.length;
      if (activeColumnId === overColumnId && sourceIndex < targetIndex) {
        targetIndex -= 1;
      }

      targetItems.splice(targetIndex, 0, movedItem);

      return current.map((column) => {
        if (column.id === activeColumnId && column.id === overColumnId) {
          return { ...column, items: targetItems };
        }
        if (column.id === activeColumnId) {
          return { ...column, items: sourceItems };
        }
        if (column.id === overColumnId) {
          return { ...column, items: targetItems };
        }
        return column;
      });
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <KanbanBoardInteractive columns={columns} className={className} />
    </DndContext>
  );
}

function KanbanBoardStatic({
  columns,
  className,
}: {
  columns: KanbanColumn[];
  className?: string;
}) {
  return (
    <section className={cn("overflow-x-auto rounded-sm border border-border bg-card p-4", className)}>
      <div className="flex min-w-[56rem] gap-3">
        {columns.map((column) => (
          <section
            key={column.id}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-sm border p-3",
              columnTones[column.tone ?? "neutral"] ?? columnTones.neutral,
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{column.title}</p>
                <p className="text-xs text-muted-foreground">{column.items.length} items</p>
              </div>
            </div>
            <div className="space-y-2">
              {column.items.map((item) => (
                <KanbanCard key={item.id} item={item} />
              ))}
              {column.items.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                  No items
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function KanbanBoardInteractive({
  columns,
  className,
}: {
  columns: KanbanColumn[];
  className?: string;
}) {
  return (
    <section className={cn("overflow-x-auto rounded-sm border border-border bg-card p-4", className)}>
      <div className="flex min-w-[56rem] gap-3">
        {columns.map((column) => (
          <KanbanLane key={column.id} column={column} />
        ))}
      </div>
    </section>
  );
}

function KanbanLane({
  column,
}: {
  column: KanbanColumn;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-sm border p-3",
        columnTones[column.tone ?? "neutral"] ?? columnTones.neutral,
        isOver && "ring-1 ring-highlight",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{column.title}</p>
          <p className="text-xs text-muted-foreground">{column.items.length} items</p>
        </div>
      </div>
      <SortableContext items={column.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {column.items.map((item) =>
            <SortableKanbanCard key={item.id} item={item} columnId={column.id} />,
          )}
          {column.items.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
              Drop here
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableKanbanCard({
  item,
  columnId,
}: {
  item: KanbanCardItem;
  columnId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "card", columnId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-70")}
    >
      <KanbanCard item={item} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function KanbanCard({
  item,
  dragHandleProps,
}: {
  item: KanbanCardItem;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <article className="rounded-sm border border-border bg-background p-3 shadow-sm">
      <div className="flex items-start gap-2">
        {dragHandleProps ? (
          <button
            type="button"
            className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-inset text-muted-foreground"
            aria-label="Drag card"
            {...dragHandleProps}
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {item.detail ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p> : null}
          {item.meta ? <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p> : null}
        </div>
      </div>
    </article>
  );
}
''',
    "alarm-banner": r'''
import { AlertTriangle, BellRing, CircleAlert, ShieldAlert, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const alarmTones: Record<string, { icon: LucideIcon; className: string; iconWrapClassName: string; label: string }> = {
  warning: {
    icon: AlertTriangle,
    className: "border-state-paused-border bg-state-paused-bg text-state-paused-fg",
    iconWrapClassName: "border-state-paused-border bg-background/60 text-state-paused-fg",
    label: "Warning",
  },
  critical: {
    icon: ShieldAlert,
    className: "border-state-error-border bg-state-error-bg text-state-error-fg",
    iconWrapClassName: "border-state-error-border bg-background/60 text-state-error-fg",
    label: "Critical",
  },
  info: {
    icon: BellRing,
    className: "border-state-info-border bg-state-info-bg text-state-info-fg",
    iconWrapClassName: "border-state-info-border bg-background/60 text-state-info-fg",
    label: "Info",
  },
  blocked: {
    icon: CircleAlert,
    className: "border-state-error-border bg-state-error-bg text-state-error-fg",
    iconWrapClassName: "border-state-error-border bg-background/60 text-state-error-fg",
    label: "Blocking",
  },
};

export function AlarmBanner({
  severity = "warning",
  title,
  detail,
  actionLabel,
  onAction,
  onDismiss,
  className,
}: {
  severity?: "warning" | "critical" | "info" | "blocked" | string;
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const tone = alarmTones[severity.toLowerCase()] ?? alarmTones.warning;
  const Icon = tone.icon;

  return (
    <section className={cn("rounded-sm border px-3 py-3", tone.className, className)} role="alert">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-sm border",
            tone.iconWrapClassName,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            <span className="rounded-sm border border-current/25 px-1.5 py-0.5 text-[10px] font-medium leading-none">
              {tone.label}
            </span>
          </div>
          {detail ? <p className="mt-1 text-sm leading-5 opacity-90">{detail}</p> : null}
          {(actionLabel && onAction) || onDismiss ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {actionLabel && onAction ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-sm border border-current/30 bg-background/70 px-3 text-xs font-medium"
                  onClick={onAction}
                >
                  {actionLabel}
                </button>
              ) : null}
              {onDismiss ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-transparent px-2 text-xs font-medium opacity-80"
                  onClick={onDismiss}
                >
                  <X className="size-3.5" aria-hidden />
                  Close
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
''',
    "leaderboard": r'''
import { cn } from "@/lib/utils";

export interface LeaderboardItem {
  id: string;
  label: string;
  value: number;
  detail?: string;
  unit?: string;
}

export function Leaderboard({
  items,
  className,
}: {
  items: LeaderboardItem[];
  className?: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      {items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-surface-inset px-3 py-8 text-center text-sm text-muted-foreground">
          No ranking data
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => {
            const width = maxValue > 0 ? `${(item.value / maxValue) * 100}%` : "0%";
            return (
              <li key={item.id} className="rounded-sm border border-border bg-surface-inset px-3 py-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-xs font-medium text-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                        {item.detail ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p> : null}
                      </div>
                      <p className="font-mono text-sm font-medium tabular-nums text-foreground">
                        {item.value.toLocaleString()}
                        {item.unit ? item.unit : ""}
                      </p>
                    </div>
                    <div className="mt-2 h-2 rounded-full border border-border bg-background">
                      <div
                        className="h-full rounded-full bg-button-primary"
                        style={{ width }}
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
''',
    "gantt-board": r'''
import { differenceInMilliseconds, format } from "date-fns";
import { cn } from "@/lib/utils";

export interface ScheduleTask {
  id: string;
  title: string;
  subtitle?: string;
  resourceId: string;
  start: Date;
  end: Date;
  status: "PLANNED" | "LOCKED" | "RUNNING" | "DONE" | "RISK" | string;
}

export interface ScheduleResource {
  id: string;
  code: string;
  name: string;
}

const barTone: Record<string, string> = {
  PLANNED: "border-gantt-planned-border bg-gantt-planned-bg text-gantt-planned-fg",
  LOCKED: "border-gantt-locked-border bg-gantt-locked-bg text-gantt-locked-fg",
  RUNNING: "border-gantt-running-border bg-gantt-running-bg text-gantt-running-fg",
  DONE: "border-gantt-done-border bg-gantt-done-bg text-gantt-done-fg",
  RISK: "border-gantt-risk-border bg-gantt-risk-bg text-gantt-risk-fg",
};

const summaryTone: Record<string, string> = {
  neutral: "border-highlight-bg-primary bg-highlight-bg-accent text-accent-foreground",
  info: "border-state-info-border bg-state-info-bg text-state-info-fg",
  running: "border-gantt-running-border bg-gantt-running-bg text-gantt-running-fg",
  risk: "border-gantt-risk-border bg-gantt-risk-bg text-gantt-risk-fg",
  locked: "border-gantt-locked-border bg-gantt-locked-bg text-gantt-locked-fg",
};

export function GanttBoard({
  resources,
  tasks,
  timelineStart,
  timelineEnd,
  now = new Date(),
  onDelayTask,
  pendingTaskId,
  className,
}: {
  resources: ScheduleResource[];
  tasks: ScheduleTask[];
  timelineStart?: Date;
  timelineEnd?: Date;
  now?: Date;
  onDelayTask?: (task: ScheduleTask) => void;
  pendingTaskId?: string | null;
  className?: string;
}) {
  const grouped = tasks.reduce((map, task) => {
    map.set(task.resourceId, [...(map.get(task.resourceId) ?? []), task]);
    return map;
  }, new Map<string, ScheduleTask[]>());

  const timeline = buildTimeline(tasks, timelineStart, timelineEnd);

  const totalMs = Math.max(differenceInMilliseconds(timeline.end, timeline.start), 60 * 60 * 1000);
  const nowLeft = toPercent(now, timeline.start, totalMs);
  const showNow = nowLeft >= 0 && nowLeft <= 100;

  const summary = {
    total: tasks.length,
    running: tasks.filter((task) => task.status === "RUNNING").length,
    risk: tasks.filter((task) => task.status === "RISK").length,
    locked: tasks.filter((task) => task.status === "LOCKED").length,
  };

  const summaryItems = [
    { key: "total", label: "Scheduled Jobs", value: summary.total, tone: "neutral" as const },
    { key: "running", label: "Running", value: summary.running, tone: "running" as const },
    { key: "risk", label: "At-Risk Jobs", value: summary.risk, tone: "risk" as const },
    { key: "locked", label: "Locked Jobs", value: summary.locked, tone: "locked" as const },
  ];

  return (
    <section className={cn("space-y-3", className)}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <div key={item.key} className={cn("rounded-sm border px-3 py-2.5", summaryTone[item.tone ?? "neutral"])}>
            <p className="text-xs opacity-80">{item.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold leading-none tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="wide-operational-board rounded-sm border border-border bg-card p-4">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-medium">Resource Gantt Board</h2>
            <p className="text-xs text-muted-foreground">
              Time window: {format(timeline.start, "MM-dd HH:mm")} - {format(timeline.end, "MM-dd HH:mm")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              ["Planned", "bg-gantt-planned-border"],
              ["Running", "bg-gantt-running-fg"],
              ["Risk", "bg-gantt-risk-fg"],
            ].map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-muted-foreground">
                <span className={cn("size-2 rounded-full", color)} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="wide-operational-scroll">
          <div className="gantt-scroll-content">
            <div className="gantt-board-grid sticky top-0 z-20 border-b border-border bg-card">
              <div className="sticky left-0 z-30 border-r border-border bg-card py-3 pr-4 text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">
                Resource / Load
              </div>
              <div className="relative py-2">
                <div
                  className="grid border-b border-border"
                  style={{ gridTemplateColumns: `repeat(${timeline.ticks.length - 1}, minmax(6.5rem, 1fr))` }}
                >
                  {timeline.ticks.slice(0, -1).map((tick) => (
                    <div key={tick.toISOString()} className="gantt-time-label border-l border-border px-3 pb-1 text-center first:border-l-0">
                      {format(tick, "MM-dd")}
                    </div>
                  ))}
                </div>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${timeline.ticks.length - 1}, minmax(6.5rem, 1fr))` }}
                >
                  {timeline.ticks.slice(0, -1).map((tick) => (
                    <div key={tick.toISOString()} className="gantt-time-label border-l border-border/70 px-3 pt-1 text-center first:border-l-0">
                      {format(tick, "HH:mm")}
                    </div>
                  ))}
                </div>
                {showNow ? (
                  <div
                    className="pointer-events-none absolute bottom-0 top-2 z-10 border-l-2 border-state-error-fg"
                    style={{ left: `${nowLeft}%` }}
                    aria-hidden
                  >
                    <span className="absolute -top-1 left-1 rounded-sm bg-state-error-bg px-1.5 py-0.5 font-mono text-[10px] text-state-error-fg">
                      Now
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              {resources.map((resource) => {
                const rowTasks = grouped.get(resource.id) ?? [];
                const load = rowTasks.length === 0 ? 0 : Math.min(100, Math.round((rowTasks.length / Math.max(tasks.length, 1)) * 100));
                const laneHeight = 42;
                const rowHeight = Math.max(72, 22 + Math.max(rowTasks.length, 1) * laneHeight);

                return (
                  <div key={resource.id} className="gantt-board-grid border-b border-border last:border-b-0">
                    <div className="sticky left-0 z-10 border-r border-border bg-card p-3" style={{ minHeight: rowHeight }}>
                      <div className="text-sm font-medium">{resource.name}</div>
                      <div className="gantt-time-label uppercase">{resource.code}</div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Resource Load</span>
                          <span>{load}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-border/70">
                          <div className="h-2 rounded-full bg-highlight-bg-primary" style={{ width: `${load}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="relative bg-surface-inset" style={{ minHeight: rowHeight }}>
                      <div
                        className="pointer-events-none absolute inset-0 grid"
                        style={{ gridTemplateColumns: `repeat(${timeline.ticks.length - 1}, minmax(6.5rem, 1fr))` }}
                      >
                        {timeline.ticks.slice(0, -1).map((tick) => (
                          <div key={tick.toISOString()} className="border-l border-dashed border-border/70 first:border-l-0" />
                        ))}
                      </div>

                      {showNow ? (
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 z-10 border-l-2 border-state-error-fg/80"
                          style={{ left: `${nowLeft}%` }}
                          aria-hidden
                        />
                      ) : null}

                      {rowTasks.length === 0 ? (
                        <div className="relative p-3">
                          <div className="rounded-sm border border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground">
                            No scheduled jobs
                          </div>
                        </div>
                      ) : (
                        rowTasks.map((task, laneIndex) => {
                          const left = Math.max(0, toPercent(task.start, timeline.start, totalMs));
                          const width = Math.max(
                            ((task.end.getTime() - task.start.getTime()) / totalMs) * 100,
                            4,
                          );

                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "absolute z-10 flex h-8 items-center justify-between gap-2 overflow-hidden rounded-sm border px-3 text-xs shadow-sm",
                                barTone[task.status] ?? "border-border bg-card text-foreground",
                              )}
                              style={{
                                left: `${left}%`,
                                top: `${12 + laneIndex * laneHeight}px`,
                                width: `${Math.min(width, 100 - left)}%`,
                              }}
                              title={`${task.title} (${format(task.start, "MM-dd HH:mm")} - ${format(task.end, "MM-dd HH:mm")})`}
                            >
                              <span className="min-w-0 truncate">
                                <span className="font-medium">{task.title}</span>
                                {task.subtitle ? <span className="ml-2 opacity-75">{task.subtitle}</span> : null}
                              </span>
                              <span className="shrink-0 font-mono">{task.status}</span>
                              {onDelayTask ? (
                                <button
                                  type="button"
                                  className="ml-1 inline-flex h-5 shrink-0 items-center rounded-sm border border-current/30 bg-background/50 px-1.5 text-[10px] font-medium"
                                  onClick={() => onDelayTask(task)}
                                  disabled={pendingTaskId === task.id}
                                >
                                  Shift
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildTimeline(tasks: ScheduleTask[], timelineStart?: Date, timelineEnd?: Date) {
  const fallbackStart = new Date();
  fallbackStart.setHours(8, 0, 0, 0);

  const rawStart =
    timelineStart ??
    (tasks.length > 0
      ? new Date(Math.min(...tasks.map((task) => task.start.getTime())))
      : fallbackStart);
  const rawEnd =
    timelineEnd ??
    (tasks.length > 0
      ? new Date(Math.max(...tasks.map((task) => task.end.getTime())))
      : new Date(fallbackStart.getTime() + 8 * 60 * 60 * 1000));

  const start = floorToHour(rawStart);
  const requestedEnd = ceilToHour(rawEnd);
  const total = Math.max(requestedEnd.getTime() - start.getTime(), 60 * 60 * 1000);
  const stepHours = Math.max(Math.ceil(total / 10 / (60 * 60 * 1000)), 1);
  const step = stepHours * 60 * 60 * 1000;
  const intervalCount = Math.max(
    Math.ceil((requestedEnd.getTime() - start.getTime()) / step),
    1,
  );
  const end = new Date(start.getTime() + intervalCount * step);
  const ticks: Date[] = [];

  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += step) {
    ticks.push(new Date(cursor));
  }

  return { start, end, ticks };
}

function floorToHour(value: Date) {
  const next = new Date(value);
  next.setMinutes(0, 0, 0);
  return next;
}

function ceilToHour(value: Date) {
  const next = floorToHour(value);
  if (next.getTime() < value.getTime()) {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

function toPercent(value: Date, timelineStart: Date, totalMs: number) {
  return ((value.getTime() - timelineStart.getTime()) / totalMs) * 100;
}
''',
    "oee-gauge": r'''
export function OeeGauge({
  availability,
  performance,
  quality,
  size = 180,
}: {
  availability: number;
  performance: number;
  quality: number;
  size?: number;
}) {
  const oee = Math.round((availability * performance * quality) / 10000);
  const center = size / 2;
  const stroke = size * 0.075;
  const rings = [
    { value: availability, radius: center - stroke, color: "var(--state-info-fg)", label: "A" },
    { value: performance, radius: center - stroke * 2.2, color: "var(--state-paused-fg)", label: "P" },
    { value: quality, radius: center - stroke * 3.4, color: "var(--state-running-fg)", label: "Q" },
  ];
  return (
    <div style={{ width: size }} className="text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {rings.map((ring) => {
            const circumference = 2 * Math.PI * ring.radius;
            const offset = circumference * (1 - Math.min(Math.max(ring.value, 0), 100) / 100);
            return (
              <g key={ring.label} style={{ transform: "rotate(-90deg)", transformOrigin: `${center}px ${center}px` }}>
                <circle cx={center} cy={center} r={ring.radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
                <circle cx={center} cy={center} r={ring.radius} fill="none" stroke={ring.color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-semibold tabular-nums">{oee}%</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">OEE</span>
        </div>
      </div>
    </div>
  );
}
''',
    "chart-panel": r'''
import { type ReactNode } from "react";
import { ClientOnly } from "@/components/client-only";

export function ChartPanel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-sm border border-border bg-card p-4">
      <div className="h-72 min-w-0">
        <ClientOnly fallback={<div className="h-full rounded-sm border border-border bg-surface-inset" />}>
          {children}
        </ClientOnly>
      </div>
    </section>
  );
}
''',
}


def main() -> None:
  parser = argparse.ArgumentParser(description="Print MES UI starter snippets.")
  parser.add_argument("name", help="Snippet name, or 'list'.")
  args = parser.parse_args()

  if args.name == "list":
    grouped: dict[str, list[str]] = {group: [] for group in GROUP_ORDER}
    extras: list[str] = []

    for name in sorted(SNIPPETS):
      group = SNIPPET_META.get(name, ("Other", ""))[0]
      if group in grouped:
        grouped[group].append(name)
      else:
        extras.append(name)

    for group in GROUP_ORDER:
      names = grouped[group]
      if not names:
        continue
      print(f"[{group}]")
      for name in names:
        summary = SNIPPET_META.get(name, ("", ""))[1]
        print(f"- {name}: {summary}")
      print()

    if extras:
      print("[Other]")
      for name in extras:
        summary = SNIPPET_META.get(name, ("", ""))[1]
        print(f"- {name}: {summary}")
    return

  snippet = SNIPPETS.get(args.name)
  if snippet is None:
    choices = ", ".join(sorted(SNIPPETS))
    raise SystemExit(f"Unknown snippet '{args.name}'. Choices: {choices}")

  print(textwrap.dedent(snippet).strip())


if __name__ == "__main__":
  main()
