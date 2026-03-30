"use client";

import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { differenceInMinutes, format, startOfDay, addDays } from "date-fns";

/**
 * GanttChart — lightweight CSS-based Gantt for production scheduling.
 *
 * Usage:
 *   <GanttChart
 *     tasks={[
 *       { id: "1", label: "WO-001", resource: "CNC-01", start: new Date("2025-03-20T08:00"), end: new Date("2025-03-20T14:00"), status: "running" },
 *       { id: "2", label: "WO-002", resource: "CNC-01", start: new Date("2025-03-20T14:30"), end: new Date("2025-03-20T18:00"), status: "pending" },
 *     ]}
 *     dayStart={8}
 *     dayEnd={20}
 *   />
 */

export interface GanttTask {
  id: string;
  label: string;
  /** Row grouping key (machine name, line, etc.) */
  resource: string;
  start: Date;
  end: Date;
  /** Optional status for color coding */
  status?: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  /** First hour shown on the axis (0-23). Default 6. */
  dayStart?: number;
  /** Last hour shown on the axis (1-24). Default 22. */
  dayEnd?: number;
  /** Which date to display. Defaults to earliest task date. */
  date?: Date;
  className?: string;
}

const statusColors: Record<string, string> = {
  running:   "bg-[var(--accent)]",
  active:    "bg-[var(--accent)]",
  completed: "bg-emerald-500",
  done:      "bg-emerald-500",
  pending:   "bg-gray-300",
  scheduled: "bg-gray-300",
  paused:    "bg-amber-400",
  delayed:   "bg-red-400",
  setup:     "bg-blue-400",
};

export function GanttChart({
  tasks,
  dayStart = 6,
  dayEnd = 22,
  date,
  className,
}: GanttChartProps) {
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = dayStart; h < dayEnd; h++) arr.push(h);
    return arr;
  }, [dayStart, dayEnd]);

  const totalMinutes = (dayEnd - dayStart) * 60;

  const baseDate = useMemo(() => {
    if (date) return startOfDay(date);
    if (tasks.length) return startOfDay(tasks[0].start);
    return startOfDay(new Date());
  }, [date, tasks]);

  const timelineStart = useMemo(() => {
    const d = new Date(baseDate);
    d.setHours(dayStart, 0, 0, 0);
    return d;
  }, [baseDate, dayStart]);

  // Group tasks by resource
  const resources = useMemo(() => {
    const map = new Map<string, GanttTask[]>();
    tasks.forEach((t) => {
      const list = map.get(t.resource) || [];
      list.push(t);
      map.set(t.resource, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  return (
    <div className={cn("w-full overflow-x-auto rounded-lg border border-[var(--border)]", className)}>
      {/* Header */}
      <div className="flex border-b border-[var(--border)] bg-gray-50">
        <div className="w-28 shrink-0 border-r border-[var(--border)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Resource
        </div>
        <div className="relative flex flex-1">
          {hours.map((h) => (
            <div
              key={h}
              className="border-r border-[var(--border)] text-center text-[10px] text-muted-foreground"
              style={{ width: `${100 / hours.length}%`, paddingTop: 6, paddingBottom: 6 }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {resources.map(([resource, rTasks]) => (
        <div key={resource} className="flex border-b border-[var(--border)] last:border-b-0">
          <div className="flex w-28 shrink-0 items-center border-r border-[var(--border)] px-3 text-xs font-medium">
            {resource}
          </div>
          <div className="relative flex-1" style={{ minHeight: 36 }}>
            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 flex">
              {hours.map((h) => (
                <div key={h} className="border-r border-gray-100" style={{ width: `${100 / hours.length}%` }} />
              ))}
            </div>

            {/* Task bars */}
            {rTasks.map((task) => {
              const offsetMin = Math.max(0, differenceInMinutes(task.start, timelineStart));
              const durationMin = Math.max(8, differenceInMinutes(task.end, task.start));
              const left = (offsetMin / totalMinutes) * 100;
              const width = Math.min((durationMin / totalMinutes) * 100, 100 - left);
              const color = statusColors[(task.status ?? "").toLowerCase()] ?? "bg-gray-400";

              return (
                <div
                  key={task.id}
                  title={`${task.label} (${format(task.start, "HH:mm")} – ${format(task.end, "HH:mm")})`}
                  className={cn(
                    "absolute top-1.5 h-6 rounded px-1.5 text-[10px] font-medium leading-6 text-white truncate cursor-default transition-opacity hover:opacity-80",
                    color
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  {task.label}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {resources.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">No tasks scheduled</div>
      )}
    </div>
  );
}
