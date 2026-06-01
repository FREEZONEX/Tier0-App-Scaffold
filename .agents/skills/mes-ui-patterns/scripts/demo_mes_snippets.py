#!/usr/bin/env python3
"""Print app-local MES UI starter snippets.

These are templates, not a component library. Copy only the snippet needed for
the current app and adapt props, names, copy, and data fields.
"""

from __future__ import annotations

import argparse
import textwrap


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

export function MetricCard({
  label,
  value,
  unit,
  trend,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: LucideIcon;
  className?: string;
}) {
  const TrendIcon = trend && trend < 0 ? TrendingDown : TrendingUp;
  return (
    <section className={cn("rounded-sm border border-border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 font-mono">
        <span className="text-3xl font-semibold tabular-nums text-foreground">{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
      {trend !== undefined ? (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <TrendIcon className={cn("size-3.5", trend >= 0 ? "text-state-running-fg" : "text-state-error-fg")} />
          <span className="font-mono tabular-nums">{Math.abs(trend).toFixed(1)}%</span>
          <span>vs prev</span>
        </div>
      ) : null}
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
    "gantt-board": r'''
import { differenceInMinutes, format } from "date-fns";
import { cn } from "@/lib/utils";

export interface ScheduleTask {
  id: string;
  label: string;
  resource: string;
  start: Date;
  end: Date;
  status?: "running" | "scheduled" | "paused" | "delayed" | string;
}

const colors: Record<string, string> = {
  running: "bg-state-running-fg",
  scheduled: "bg-muted-foreground",
  paused: "bg-state-paused-fg",
  delayed: "bg-state-error-fg",
};

export function GanttBoard({
  tasks,
  timelineStart,
  timelineMinutes = 12 * 60,
  className,
}: {
  tasks: ScheduleTask[];
  timelineStart: Date;
  timelineMinutes?: number;
  className?: string;
}) {
  const resources = Array.from(
    tasks.reduce((map, task) => {
      map.set(task.resource, [...(map.get(task.resource) ?? []), task]);
      return map;
    }, new Map<string, ScheduleTask[]>()),
  );

  return (
    <div className={cn("overflow-x-auto rounded-sm border border-border bg-card", className)}>
      {resources.map(([resource, rowTasks]) => (
        <div key={resource} className="grid min-w-[720px] grid-cols-[7rem_1fr] border-b border-border last:border-b-0">
          <div className="flex h-10 items-center border-r border-border px-3 text-xs font-medium text-muted-foreground">
            {resource}
          </div>
          <div className="relative h-10 bg-surface-inset">
            {rowTasks.map((task) => {
              const start = Math.max(0, differenceInMinutes(task.start, timelineStart));
              const duration = Math.max(8, differenceInMinutes(task.end, task.start));
              const left = (start / timelineMinutes) * 100;
              const width = Math.min((duration / timelineMinutes) * 100, 100 - left);
              return (
                <div
                  key={task.id}
                  className={cn("absolute top-2 h-6 truncate rounded-sm px-2 text-[11px] font-medium leading-6 text-white", colors[task.status ?? ""] ?? "bg-muted-foreground")}
                  style={{ left: `${left}%`, width: `${Math.max(width, 3)}%` }}
                  title={`${task.label} (${format(task.start, "HH:mm")} - ${format(task.end, "HH:mm")})`}
                >
                  {task.label}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {resources.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks scheduled</div>
      ) : null}
    </div>
  );
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
import { ClientOnly } from "@/components/client-only";

export function ChartPanel({ children }: { children: React.ReactNode }) {
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
    print("\n".join(sorted(SNIPPETS)))
    return

  snippet = SNIPPETS.get(args.name)
  if snippet is None:
    choices = ", ".join(sorted(SNIPPETS))
    raise SystemExit(f"Unknown snippet '{args.name}'. Choices: {choices}")

  print(textwrap.dedent(snippet).strip())


if __name__ == "__main__":
  main()
