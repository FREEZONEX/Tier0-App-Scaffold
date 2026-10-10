"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  addMonths,
  compareDay,
  isSameDay,
  monthGrid,
  type WallTime,
} from "@/components/kit/ui/date-utils";

export interface CalendarPanelProps {
  viewYear: number;
  viewMonth: number;
  onViewChange: (year: number, month: number) => void;
  today: WallTime;
  /** Single selection. */
  selected?: WallTime | null;
  /** Range selection (either end may be null while picking). */
  rangeStart?: WallTime | null;
  rangeEnd?: WallTime | null;
  /** Hovered day used to preview an open range. */
  hoverDay?: WallTime | null;
  onHoverDay?: (day: WallTime | null) => void;
  isDisabled?: (day: WallTime) => boolean;
  onPick: (day: WallTime) => void;
  /** Hide the «‹ or ›» header buttons (dual-month range panels). */
  hidePrev?: boolean;
  hideNext?: boolean;
  className?: string;
}

type PanelMode = "date" | "month" | "year";

function HeaderButton({
  label,
  onClick,
  children,
  hidden,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-fill-hover hover:text-foreground",
        hidden && "invisible",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Month calendar with year / month drill-up (Monday first). */
export function CalendarPanel({
  viewYear,
  viewMonth,
  onViewChange,
  today,
  selected,
  rangeStart,
  rangeEnd,
  hoverDay,
  onHoverDay,
  isDisabled,
  onPick,
  hidePrev = false,
  hideNext = false,
  className,
}: CalendarPanelProps) {
  const [mode, setMode] = useState<PanelMode>("date");
  const decadeStart = Math.floor(viewYear / 10) * 10;

  const previewEnd = rangeStart && !rangeEnd ? hoverDay ?? null : rangeEnd ?? null;
  const [lowBound, highBound] =
    rangeStart && previewEnd && compareDay(previewEnd, rangeStart) < 0
      ? [previewEnd, rangeStart]
      : [rangeStart ?? null, previewEnd];

  function shiftMonth(delta: number) {
    const next = addMonths(viewYear, viewMonth, delta);
    onViewChange(next.year, next.month);
  }

  return (
    <div className={cn("w-[280px] select-none", className)}>
      <div className="flex h-10 items-center justify-between border-b border-border-secondary px-2">
        <div className="flex items-center">
          <HeaderButton
            label={mode === "year" ? "上一个十年" : "上一年"}
            hidden={hidePrev}
            onClick={() => (mode === "year" ? onViewChange(viewYear - 10, viewMonth) : shiftMonth(-12))}
          >
            <ChevronsLeft className="size-4" />
          </HeaderButton>
          {mode === "date" ? (
            <HeaderButton label="上个月" hidden={hidePrev} onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="size-4" />
            </HeaderButton>
          ) : null}
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
          {mode === "year" ? (
            <span>
              {decadeStart}年 - {decadeStart + 9}年
            </span>
          ) : (
            <>
              <button
                type="button"
                tabIndex={-1}
                className="rounded-sm px-1 hover:text-brand"
                onClick={() => setMode("year")}
              >
                {viewYear}年
              </button>
              {mode === "date" ? (
                <button
                  type="button"
                  tabIndex={-1}
                  className="rounded-sm px-1 hover:text-brand"
                  onClick={() => setMode("month")}
                >
                  {viewMonth}月
                </button>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center">
          {mode === "date" ? (
            <HeaderButton label="下个月" hidden={hideNext} onClick={() => shiftMonth(1)}>
              <ChevronRight className="size-4" />
            </HeaderButton>
          ) : null}
          <HeaderButton
            label={mode === "year" ? "下一个十年" : "下一年"}
            hidden={hideNext}
            onClick={() => (mode === "year" ? onViewChange(viewYear + 10, viewMonth) : shiftMonth(12))}
          >
            <ChevronsRight className="size-4" />
          </HeaderButton>
        </div>
      </div>

      {mode === "date" ? (
        <div className="px-3 py-2" onMouseLeave={() => onHoverDay?.(null)}>
          <div className="grid grid-cols-7 text-center text-xs leading-8 text-text-tertiary">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid(viewYear, viewMonth).map(({ wall, inMonth }) => {
              const disabled = isDisabled?.(wall) ?? false;
              const isSelected =
                isSameDay(wall, selected ?? null) ||
                isSameDay(wall, rangeStart ?? null) ||
                isSameDay(wall, rangeEnd ?? null);
              const inRange =
                Boolean(lowBound && highBound) &&
                compareDay(wall, lowBound as WallTime) > 0 &&
                compareDay(wall, highBound as WallTime) < 0;
              const isRangeEdge =
                Boolean(lowBound && highBound) &&
                (isSameDay(wall, lowBound) || isSameDay(wall, highBound));
              const isToday = isSameDay(wall, today);
              return (
                <div
                  key={`${wall.year}-${wall.month}-${wall.day}`}
                  className={cn(
                    "flex h-8 items-center justify-center",
                    (inRange || isRangeEdge) && inMonth && "bg-brand-soft",
                    isRangeEdge && lowBound && isSameDay(wall, lowBound) && "rounded-l-sm",
                    isRangeEdge && highBound && isSameDay(wall, highBound) && "rounded-r-sm",
                  )}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={disabled}
                    aria-pressed={isSelected}
                    aria-label={`${wall.year}年${wall.month}月${wall.day}日`}
                    className={cn(
                      "relative size-6 rounded-sm text-sm leading-6 tabular-nums transition-colors",
                      inMonth ? "text-foreground" : "text-text-placeholder",
                      !isSelected && !disabled && "hover:bg-fill-hover",
                      isToday && !isSelected && "shadow-[inset_0_0_0_1px_var(--tier0-primary)]",
                      isSelected && "bg-brand text-white",
                      disabled && "cursor-not-allowed bg-input-disabled text-text-placeholder",
                    )}
                    onMouseEnter={() => onHoverDay?.(wall)}
                    onClick={() => onPick(wall)}
                  >
                    {wall.day}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : mode === "month" ? (
        <div className="grid grid-cols-3 gap-y-5 px-3 py-6">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <div key={month} className="flex justify-center">
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  "h-7 w-14 rounded-sm text-sm transition-colors",
                  month === viewMonth ? "bg-brand text-white" : "hover:bg-fill-hover",
                  month === today.month && viewYear === today.year && month !== viewMonth && "text-brand",
                )}
                onClick={() => {
                  onViewChange(viewYear, month);
                  setMode("date");
                }}
              >
                {month}月
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-y-5 px-3 py-6">
          {Array.from({ length: 12 }, (_, index) => decadeStart - 1 + index).map((year) => (
            <div key={year} className="flex justify-center">
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  "h-7 w-14 rounded-sm text-sm tabular-nums transition-colors",
                  year === viewYear ? "bg-brand text-white" : "hover:bg-fill-hover",
                  (year < decadeStart || year > decadeStart + 9) && year !== viewYear && "text-text-placeholder",
                )}
                onClick={() => {
                  onViewChange(year, viewMonth);
                  setMode("month");
                }}
              >
                {year}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface TimeColumnsProps {
  value: WallTime;
  withSeconds?: boolean;
  onChange: (value: WallTime) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const ITEM_HEIGHT = 28;

function TimeColumn({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.scrollTo({ top: selected * ITEM_HEIGHT, behavior: "smooth" });
  }, [selected]);
  return (
    <div
      ref={ref}
      role="listbox"
      data-bare-control=""
      aria-label={label}
      className="scrollbar-none h-[252px] w-14 overflow-y-auto border-l border-border-secondary py-1 first:border-l-0"
    >
      {items.map((item) => (
        <button
          type="button"
          key={item}
          role="option"
          tabIndex={-1}
          aria-selected={item === selected}
          className={cn(
            "mx-1 flex h-7 w-12 items-center justify-center rounded-sm text-sm tabular-nums transition-colors",
            item === selected ? "bg-brand-soft font-medium text-foreground" : "hover:bg-fill-hover",
          )}
          onClick={() => onSelect(item)}
        >
          {String(item).padStart(2, "0")}
        </button>
      ))}
      <div style={{ height: 224 }} aria-hidden="true" />
    </div>
  );
}

/** Hour / minute (/ second) scroll columns. */
export function TimeColumns({ value, withSeconds = false, onChange, className }: TimeColumnsProps) {
  return (
    <div className={cn("flex border-l border-border-secondary", className)}>
      <div className="flex flex-col">
        <div className="flex h-10 items-center justify-center border-b border-border-secondary text-sm font-semibold tabular-nums">
          {String(value.hour).padStart(2, "0")}:{String(value.minute).padStart(2, "0")}
          {withSeconds ? `:${String(value.second).padStart(2, "0")}` : ""}
        </div>
        <div className="flex">
          <TimeColumn label="时" items={HOURS} selected={value.hour} onSelect={(hour) => onChange({ ...value, hour })} />
          <TimeColumn
            label="分"
            items={MINUTES}
            selected={value.minute}
            onSelect={(minute) => onChange({ ...value, minute })}
          />
          {withSeconds ? (
            <TimeColumn
              label="秒"
              items={MINUTES}
              selected={value.second}
              onSelect={(second) => onChange({ ...value, second })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
