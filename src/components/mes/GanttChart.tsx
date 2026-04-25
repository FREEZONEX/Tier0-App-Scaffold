"use client";

import { cn } from "@/lib/utils";
import { useMemo, useRef, useCallback, useState } from "react";
import { differenceInMinutes, format, startOfDay, addMinutes } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * GanttChart — CSS-based Gantt for production scheduling with optional drag-and-drop.
 *
 * Read-only usage:
 *   <GanttChart tasks={tasks} dayStart={8} dayEnd={20} />
 *
 * Draggable (scheduling) usage:
 *   <GanttChart
 *     tasks={tasks}
 *     onTaskMove={(taskId, newStart, newEnd, newResource) => {
 *       // update your state / call API
 *     }}
 *     snapMinutes={15}
 *   />
 *
 * When `onTaskMove` is provided, task bars become draggable:
 * - Horizontal drag → reschedule (change start/end time, preserving duration)
 * - Vertical drag → reassign resource (move to different row)
 * - Right-edge drag → resize duration
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
  /** Called when a task is dragged to a new position. If provided, task bars become draggable. */
  onTaskMove?: (taskId: string, newStart: Date, newEnd: Date, newResource: string) => void;
  /** Snap interval in minutes for drag operations. Default 15. */
  snapMinutes?: number;
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

const ROW_HEIGHT = 36;
const RESOURCE_COL_WIDTH = 112; // w-28 = 7rem = 112px

interface DragState {
  taskId: string;
  mode: "move" | "resize";
  /** Pixel offset from task bar left edge to pointer on drag start */
  offsetX: number;
  /** Original task data */
  originalTask: GanttTask;
  /** Current preview position */
  previewLeft: number;
  previewWidth: number;
  previewResource: string;
}

export function GanttChart({
  tasks,
  dayStart = 6,
  dayEnd = 22,
  date,
  onTaskMove,
  snapMinutes = 15,
  className,
}: GanttChartProps) {
  const isDraggable = !!onTaskMove;
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

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

  const resources = useMemo(() => {
    const map = new Map<string, GanttTask[]>();
    tasks.forEach((t) => {
      const list = map.get(t.resource) || [];
      list.push(t);
      map.set(t.resource, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  const resourceNames = useMemo(() => resources.map(([name]) => name), [resources]);

  // Convert pixel X (relative to timeline area) to minutes from timeline start, snapped
  const pxToMinutes = useCallback((px: number, timelineWidth: number) => {
    const raw = (px / timelineWidth) * totalMinutes;
    return Math.round(raw / snapMinutes) * snapMinutes;
  }, [totalMinutes, snapMinutes]);

  // Convert minutes to percentage
  const minToPercent = useCallback((min: number) => {
    return (min / totalMinutes) * 100;
  }, [totalMinutes]);

  // Determine which resource row a Y position falls into
  const yToResource = useCallback((y: number) => {
    // y is relative to the rows container (after header)
    const rowIndex = Math.max(0, Math.min(resourceNames.length - 1, Math.floor(y / ROW_HEIGHT)));
    return resourceNames[rowIndex] ?? resourceNames[0];
  }, [resourceNames]);

  const handlePointerDown = useCallback((e: React.PointerEvent, task: GanttTask, mode: "move" | "resize") => {
    if (!isDraggable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const container = containerRef.current;
    if (!container) return;

    const timelineArea = container.querySelector("[data-gantt-rows]") as HTMLElement;
    if (!timelineArea) return;

    const rect = timelineArea.getBoundingClientRect();
    const barEl = (e.currentTarget as HTMLElement);
    const barRect = barEl.getBoundingClientRect();

    const offsetMin = Math.max(0, differenceInMinutes(task.start, timelineStart));
    const durationMin = Math.max(8, differenceInMinutes(task.end, task.start));

    setDrag({
      taskId: task.id,
      mode,
      offsetX: e.clientX - barRect.left,
      originalTask: task,
      previewLeft: minToPercent(offsetMin),
      previewWidth: minToPercent(durationMin),
      previewResource: task.resource,
    });
  }, [isDraggable, timelineStart, minToPercent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag) return;
    const container = containerRef.current;
    if (!container) return;

    const timelineArea = container.querySelector("[data-gantt-rows]") as HTMLElement;
    if (!timelineArea) return;

    const rect = timelineArea.getBoundingClientRect();
    const timelineWidth = rect.width;

    if (drag.mode === "move") {
      // Horizontal: calculate new start position
      const pointerXInTimeline = e.clientX - rect.left - drag.offsetX;
      const newStartMin = Math.max(0, pxToMinutes(pointerXInTimeline, timelineWidth));
      const durationMin = differenceInMinutes(drag.originalTask.end, drag.originalTask.start);
      const clampedStart = Math.min(newStartMin, totalMinutes - durationMin);

      // Vertical: determine target resource
      const pointerYInRows = e.clientY - rect.top;
      const newResource = yToResource(pointerYInRows);

      setDrag((prev) => prev ? {
        ...prev,
        previewLeft: minToPercent(Math.max(0, clampedStart)),
        previewResource: newResource,
      } : null);
    } else {
      // Resize: change width (duration)
      const barLeftPx = (drag.previewLeft / 100) * timelineWidth;
      const pointerXInTimeline = e.clientX - rect.left;
      const newEndMin = pxToMinutes(pointerXInTimeline, timelineWidth);
      const startMin = pxToMinutes(barLeftPx, timelineWidth);
      const newWidth = minToPercent(Math.max(snapMinutes, newEndMin - startMin));

      setDrag((prev) => prev ? { ...prev, previewWidth: newWidth } : null);
    }
  }, [drag, pxToMinutes, minToPercent, totalMinutes, yToResource]);

  const handlePointerUp = useCallback(() => {
    if (!drag || !onTaskMove) return;

    const container = containerRef.current;
    if (!container) return;

    const timelineArea = container.querySelector("[data-gantt-rows]") as HTMLElement;
    if (!timelineArea) return;

    const timelineWidth = timelineArea.getBoundingClientRect().width;

    const newStartMin = pxToMinutes((drag.previewLeft / 100) * timelineWidth, timelineWidth);
    const newStart = addMinutes(timelineStart, newStartMin);

    let newEnd: Date;
    if (drag.mode === "resize") {
      const newEndMin = pxToMinutes(((drag.previewLeft + drag.previewWidth) / 100) * timelineWidth, timelineWidth);
      newEnd = addMinutes(timelineStart, newEndMin);
    } else {
      const durationMin = differenceInMinutes(drag.originalTask.end, drag.originalTask.start);
      newEnd = addMinutes(newStart, durationMin);
    }

    onTaskMove(drag.taskId, newStart, newEnd, drag.previewResource);
    setDrag(null);
  }, [drag, onTaskMove, pxToMinutes, timelineStart]);

  // Find the resource row index for the drag preview
  const dragPreviewRowIndex = drag ? resourceNames.indexOf(drag.previewResource) : -1;

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-x-auto rounded-lg border border-[var(--border)]", className)}
      onPointerMove={drag ? handlePointerMove : undefined}
      onPointerUp={drag ? handlePointerUp : undefined}
      onPointerCancel={drag ? () => setDrag(null) : undefined}
    >
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
      <div data-gantt-rows="" className="relative">
        {resources.map(([resource, rTasks], rowIndex) => (
          <div key={resource} className="flex border-b border-[var(--border)] last:border-b-0">
            <div className="flex w-28 shrink-0 items-center border-r border-[var(--border)] px-3 text-xs font-medium" style={{ height: ROW_HEIGHT }}>
              {resource}
            </div>
            <div className="relative flex-1" style={{ height: ROW_HEIGHT }}>
              {/* Grid lines */}
              <div className="pointer-events-none absolute inset-0 flex">
                {hours.map((h) => (
                  <div key={h} className="border-r border-gray-100" style={{ width: `${100 / hours.length}%` }} />
                ))}
              </div>

              {/* Task bars */}
              {rTasks.map((task) => {
                const isDragging = drag?.taskId === task.id;
                const offsetMin = Math.max(0, differenceInMinutes(task.start, timelineStart));
                const durationMin = Math.max(8, differenceInMinutes(task.end, task.start));
                const left = (offsetMin / totalMinutes) * 100;
                const width = Math.min((durationMin / totalMinutes) * 100, 100 - left);
                const color = statusColors[(task.status ?? "").toLowerCase()] ?? "bg-gray-400";

                // Hide original bar when dragging (preview shown separately)
                if (isDragging) return null;

                return (
                  <Tooltip key={task.id}>
                    <TooltipTrigger
                      className={cn(
                        "absolute top-1.5 h-6 rounded px-1.5 text-[10px] font-medium leading-6 text-white truncate transition-opacity hover:opacity-80",
                        color,
                        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onPointerDown={isDraggable ? (e) => handlePointerDown(e, task, "move") : undefined}
                    >
                      {task.label}
                      {/* Resize handle */}
                      {isDraggable && (
                        <span
                          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handlePointerDown(e, task, "resize");
                          }}
                        />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="text-xs">{task.label} ({format(task.start, "HH:mm")} – {format(task.end, "HH:mm")})</span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}

        {/* Drag preview overlay */}
        {drag && dragPreviewRowIndex >= 0 && (
          <div
            className={cn(
              "pointer-events-none absolute h-6 rounded px-1.5 text-[10px] font-medium leading-6 text-white truncate ring-2 ring-[var(--accent)] shadow-[var(--shadow-lg)]",
              statusColors[(drag.originalTask.status ?? "").toLowerCase()] ?? "bg-gray-400"
            )}
            style={{
              left: `calc(${RESOURCE_COL_WIDTH}px + (100% - ${RESOURCE_COL_WIDTH}px) * ${drag.previewLeft} / 100)`,
              width: `calc((100% - ${RESOURCE_COL_WIDTH}px) * ${drag.previewWidth} / 100)`,
              top: dragPreviewRowIndex * ROW_HEIGHT + 6,
            }}
          >
            {drag.originalTask.label}
          </div>
        )}

        {resources.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">No tasks scheduled</div>
        )}
      </div>
    </div>
  );
}
