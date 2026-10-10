"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, CalendarDays, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarPanel, TimeColumns } from "@/components/kit/ui/calendar";
import {
  BARE_INPUT_CLASS,
  CONTROL_PADDING_X,
  FLOATING_PANEL_CLASS,
  controlFrameClass,
  type ControlSize,
  type ControlStatus,
  type ControlVariant,
} from "@/components/kit/ui/control-styles";
import {
  DATE_PLACEHOLDER,
  compareDay,
  compareWall,
  endOfDay,
  formatWall,
  nowWall,
  parseDateValue,
  serializeWall,
  startOfDay,
  type DatePrecision,
  type DateValueFormat,
  type WallTime,
} from "@/components/kit/ui/date-utils";
import {
  useControllableState,
  useFloatingPosition,
  useLayerDismiss,
  type Placement,
} from "@/components/kit/ui/floating";
import { FloatingLayer } from "@/components/kit/ui/layer";

interface PickerCommonProps {
  /** DATE (default) · DATETIME_MINUTE · DATETIME_SECOND. */
  precision?: DatePrecision;
  /** Output format: "date" (YYYY-MM-DD, default for DATE), "iso" (default for DATETIME), "wall". */
  valueFormat?: DateValueFormat;
  allowClear?: boolean;
  disabled?: boolean;
  size?: ControlSize;
  status?: ControlStatus;
  variant?: ControlVariant;
  /** Return true to disable a calendar day. */
  disabledDate?: (day: WallTime) => boolean;
  placement?: Placement;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

function withSecondsOf(precision: DatePrecision) {
  return precision === "DATETIME_SECOND";
}

function parseTyped(text: string, precision: DatePrecision): WallTime | null {
  const wall = parseDateValue(text.trim());
  if (!wall) return null;
  return precision === "DATE" ? startOfDay(wall) : wall;
}

/* ------------------------------------------------------------------ */
/* DatePicker                                                           */
/* ------------------------------------------------------------------ */

export interface DatePickerProps extends PickerCommonProps {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  /** Show 「今天」/「此刻」 shortcut (default true). */
  showNow?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DatePicker({
  value,
  defaultValue = null,
  onChange,
  precision = "DATE",
  valueFormat,
  placeholder,
  allowClear = true,
  disabled = false,
  size = "md",
  status,
  variant = "outlined",
  disabledDate,
  showNow = true,
  placement = "bottom-start",
  open,
  onOpenChange,
  className,
  id,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const layerId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stored, setStored] = useControllableState<string | null>(value, defaultValue);
  const [isOpen, setOpenState] = useControllableState(open, false, onOpenChange);
  const [typed, setTyped] = useState<string | null>(null);
  const [draft, setDraft] = useState<WallTime | null>(null);
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const visible = isOpen && !disabled;
  const current = parseDateValue(stored);
  const isDateOnly = precision === "DATE";
  const position = useFloatingPosition({ open: visible, anchorRef: frameRef, floatingRef, placement, offset: 4 });

  function setOpen(next: boolean) {
    if (next === isOpen) return;
    if (next) {
      const base = current ?? nowWall();
      setDraft(current);
      setView({ year: base.year, month: base.month });
    } else {
      setDraft(null);
      setTyped(null);
    }
    setOpenState(next);
  }

  useLayerDismiss({
    open: visible,
    layerId,
    anchorRef: frameRef,
    // Clicking elsewhere (e.g. 查询) keeps what was typed; Escape discards it.
    onDismiss: (reason) => {
      if (reason === "outside") commitTyped();
      setOpen(false);
    },
  });

  function commit(wall: WallTime | null) {
    const next = wall ? serializeWall(wall, precision, valueFormat) : null;
    setStored(next);
    onChange?.(next);
  }

  function pickDay(day: WallTime) {
    if (isDateOnly) {
      commit(startOfDay(day));
      setOpen(false);
      return;
    }
    const time = draft ?? current ?? { ...day, hour: 0, minute: 0, second: 0 };
    setDraft({ ...day, hour: time.hour, minute: time.minute, second: time.second });
  }

  function commitTyped() {
    if (typed === null) return;
    if (typed.trim() === "") commit(null);
    else {
      const parsed = parseTyped(typed, precision);
      if (parsed && !(disabledDate?.(parsed) ?? false)) commit(parsed);
    }
    setTyped(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (typed !== null) {
        commitTyped();
        setOpen(false);
      } else if (!visible) setOpen(true);
      else if (!isDateOnly && draft) {
        commit(draft);
        setOpen(false);
      }
    } else if (event.key === "ArrowDown" && !visible) {
      setOpen(true);
    } else if (event.key === "Tab") {
      commitTyped();
      setOpen(false);
    }
  }

  const today = nowWall();
  const display = typed ?? (draft && visible && !isDateOnly ? formatWall(draft, precision) : current ? formatWall(current, precision) : "");
  const showClear = allowClear && !disabled && Boolean(stored);
  const viewYear = view?.year ?? today.year;
  const viewMonth = view?.month ?? today.month;

  return (
    <div
      ref={frameRef}
      className={cn(
        controlFrameClass({ size, status, variant, disabled, active: visible, fixedHeight: true }),
        "group gap-1",
        CONTROL_PADDING_X[size],
        className,
      )}
      onMouseDown={(event) => {
        // The panel is portaled but still a React child: ignore its bubbled events.
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        if (disabled) return;
        if (event.target instanceof Element && event.target.closest("[data-picker-ignore]")) return;
        if (event.target !== inputRef.current) event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        data-bare-control=""
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={visible}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder ?? DATE_PLACEHOLDER[precision]}
        value={display}
        className={cn(BARE_INPUT_CLASS, "h-[22px] tabular-nums")}
        onChange={(event) => {
          setTyped(event.target.value);
          const parsed = parseTyped(event.target.value, precision);
          if (parsed) {
            setView({ year: parsed.year, month: parsed.month });
            if (!isDateOnly) setDraft(parsed);
          }
        }}
        onBlur={(event) => {
          if (floatingRef.current?.contains(event.relatedTarget as Node | null)) return;
          commitTyped();
        }}
        onKeyDown={handleKeyDown}
      />
      <span className="relative flex size-4 shrink-0 items-center justify-center text-text-placeholder">
        <CalendarDays className={cn("size-3.5 transition-opacity", showClear && "group-hover:opacity-0")} />
        {showClear ? (
          <button
            type="button"
            data-picker-ignore=""
            tabIndex={-1}
            aria-label="清除"
            className="absolute inset-0 flex items-center justify-center bg-card text-text-placeholder opacity-0 transition-opacity hover:text-text-tertiary group-hover:opacity-100"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              commit(null);
              setOpen(false);
            }}
          >
            <CircleX className="size-3.5" />
          </button>
        ) : null}
      </span>

      <FloatingLayer
        open={visible}
        layerId={layerId}
        floatingRef={floatingRef}
        style={position.style}
        placement={position.placement}
        role="dialog"
        aria-label="选择日期"
        className={cn(FLOATING_PANEL_CLASS, "overflow-hidden")}
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="flex">
          <CalendarPanel
            viewYear={viewYear}
            viewMonth={viewMonth}
            onViewChange={(year, month) => setView({ year, month })}
            today={today}
            selected={isDateOnly ? current : draft}
            isDisabled={disabledDate}
            onPick={pickDay}
          />
          {!isDateOnly ? (
            <TimeColumns
              value={draft ?? { ...(current ?? today), hour: 0, minute: 0, second: 0 }}
              withSeconds={withSecondsOf(precision)}
              onChange={(next) => setDraft(next)}
            />
          ) : null}
        </div>
        {showNow || !isDateOnly ? (
          <div className="flex h-10 items-center justify-between gap-2 border-t border-border-secondary px-3">
            {showNow ? (
              <button
                type="button"
                tabIndex={-1}
                className="text-sm text-brand hover:text-brand-hover"
                onClick={() => {
                  const now = nowWall();
                  if (disabledDate?.(now)) return;
                  commit(isDateOnly ? startOfDay(now) : now);
                  setOpen(false);
                }}
              >
                {isDateOnly ? "今天" : "此刻"}
              </button>
            ) : (
              <span />
            )}
            {!isDateOnly ? (
              <Button
                size="sm"
                disabled={!draft}
                onClick={() => {
                  if (!draft) return;
                  commit(draft);
                  setOpen(false);
                }}
              >
                确定
              </Button>
            ) : null}
          </div>
        ) : null}
      </FloatingLayer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DateRangePicker                                                      */
/* ------------------------------------------------------------------ */

export type DateRangeValue = [string | null, string | null];

export interface DateRangePreset {
  label: string;
  /** Returns [start, end] in the picker's value format. */
  value: () => [string, string];
}

export interface DateRangePickerProps extends PickerCommonProps {
  value?: DateRangeValue | null;
  defaultValue?: DateRangeValue | null;
  /** Emits both ends, or null when cleared. */
  onChange?: (value: [string, string] | null) => void;
  placeholder?: [string, string];
  /** Quick ranges shown on the left of the panel. */
  presets?: DateRangePreset[];
  /** DATETIME: default end-of-day time for a picked end date (default true). */
  endOfDayForEnd?: boolean;
}

type Side = "start" | "end";

export function DateRangePicker({
  value,
  defaultValue = null,
  onChange,
  precision = "DATE",
  valueFormat,
  placeholder,
  allowClear = true,
  disabled = false,
  size = "md",
  status,
  variant = "outlined",
  disabledDate,
  presets,
  endOfDayForEnd = true,
  placement = "bottom-start",
  className,
  id,
  "aria-label": ariaLabel,
}: DateRangePickerProps) {
  const layerId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const [stored, setStored] = useControllableState<DateRangeValue | null>(value, defaultValue);
  const [visible, setVisible] = useState(false);
  const [side, setSide] = useState<Side>("start");
  const [draftStart, setDraftStart] = useState<WallTime | null>(null);
  const [draftEnd, setDraftEnd] = useState<WallTime | null>(null);
  const [hoverDay, setHoverDay] = useState<WallTime | null>(null);
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [typed, setTyped] = useState<{ side: Side; text: string } | null>(null);
  const [wide, setWide] = useState(true);
  const isDateOnly = precision === "DATE";
  const currentStart = parseDateValue(stored?.[0]);
  const currentEnd = parseDateValue(stored?.[1]);
  const position = useFloatingPosition({ open: visible && !disabled, anchorRef: frameRef, floatingRef, placement, offset: 4 });
  const defaultPlaceholder: [string, string] = isDateOnly ? ["开始日期", "结束日期"] : ["开始时间", "结束时间"];
  const [startPlaceholder, endPlaceholder] = placeholder ?? defaultPlaceholder;

  function openPanel(nextSide: Side) {
    if (disabled) return;
    setSide(nextSide);
    if (!visible) {
      const base = (nextSide === "end" ? currentEnd ?? currentStart : currentStart ?? currentEnd) ?? nowWall();
      setDraftStart(currentStart);
      setDraftEnd(currentEnd);
      setView({ year: base.year, month: base.month });
      setWide(typeof window === "undefined" ? true : window.innerWidth >= 640);
      setVisible(true);
    }
  }

  function closePanel() {
    setVisible(false);
    setHoverDay(null);
    setTyped(null);
  }

  useLayerDismiss({
    open: visible && !disabled,
    layerId,
    anchorRef: frameRef,
    // Clicking elsewhere (e.g. 查询) keeps a typed range; Escape discards it.
    onDismiss: (reason) => {
      if (reason === "outside") commitTyped();
      closePanel();
    },
  });

  function commit(start: WallTime | null, end: WallTime | null) {
    if (!start || !end) {
      setStored(null);
      onChange?.(null);
      return;
    }
    const [low, high] = compareWall(end, start) < 0 ? [end, start] : [start, end];
    const next: [string, string] = [
      serializeWall(isDateOnly ? startOfDay(low) : low, precision, valueFormat),
      serializeWall(isDateOnly ? startOfDay(high) : high, precision, valueFormat),
    ];
    setStored(next);
    onChange?.(next);
  }

  function pickDay(day: WallTime) {
    if (isDateOnly) {
      if (side === "start" || !draftStart) {
        setDraftStart(startOfDay(day));
        setDraftEnd(null);
        setSide("end");
        return;
      }
      const start = draftStart;
      const end = startOfDay(day);
      commit(start, end);
      closePanel();
      return;
    }
    if (side === "start") {
      const time = draftStart ?? startOfDay(day);
      setDraftStart({ ...day, hour: time.hour, minute: time.minute, second: time.second });
      if (draftEnd && compareDay(draftEnd, day) < 0) setDraftEnd(null);
    } else {
      const time = draftEnd ?? (endOfDayForEnd ? endOfDay(day) : startOfDay(day));
      setDraftEnd({
        ...day,
        hour: time.hour,
        minute: time.minute,
        second: precision === "DATETIME_MINUTE" ? 0 : time.second,
      });
    }
  }

  function confirmSide() {
    if (side === "start") {
      if (!draftStart) return;
      if (!draftEnd || compareWall(draftEnd, draftStart) < 0) {
        setSide("end");
        endInputRef.current?.focus();
        return;
      }
    }
    if (!draftStart || !draftEnd) {
      setSide(draftStart ? "end" : "start");
      return;
    }
    commit(draftStart, draftEnd);
    closePanel();
  }

  /** Applies the typed text; returns true when a complete range (or a clear) was committed. */
  function commitTyped(): boolean {
    if (!typed) return false;
    let committed = false;
    const parsed = typed.text.trim() === "" ? null : parseTyped(typed.text, precision);
    if (typed.text.trim() === "") {
      commit(null, null);
      committed = true;
    } else if (parsed) {
      // While the panel is open the other side may only exist as a draft
      // (typed start, then typed end), so prefer the draft over the stored value.
      const otherStart = visible ? draftStart ?? currentStart : currentStart;
      const otherEnd = visible ? draftEnd ?? currentEnd : currentEnd;
      const start = typed.side === "start" ? parsed : otherStart;
      const end = typed.side === "end" ? parsed : otherEnd;
      // Keep the draft in step so the open panel shows what was typed.
      if (typed.side === "start") setDraftStart(parsed);
      else setDraftEnd(parsed);
      if (start && end) {
        commit(start, end);
        committed = true;
      }
    }
    setTyped(null);
    return committed;
  }

  const today = nowWall();
  const viewYear = view?.year ?? today.year;
  const viewMonth = view?.month ?? today.month;
  const showDual = isDateOnly && wide;
  const startWall = visible ? draftStart : currentStart;
  const endWall = visible ? draftEnd : currentEnd;
  const startText =
    typed?.side === "start" ? typed.text : startWall ? formatWall(startWall, precision) : "";
  const endText = typed?.side === "end" ? typed.text : endWall ? formatWall(endWall, precision) : "";
  const showClear = allowClear && !disabled && Boolean(stored?.[0] || stored?.[1]);
  const timeValue =
    side === "start"
      ? draftStart ?? startOfDay(draftEnd ?? today)
      : draftEnd ?? (endOfDayForEnd ? endOfDay(draftStart ?? today) : startOfDay(draftStart ?? today));

  function inputFor(which: Side): ReactNode {
    const ref = which === "start" ? startInputRef : endInputRef;
    return (
      <span className="relative flex h-full min-w-0 flex-1 items-center">
        <input
          ref={ref}
          id={which === "start" ? id : undefined}
          data-bare-control=""
          aria-label={`${ariaLabel ?? ""}${which === "start" ? startPlaceholder : endPlaceholder}`}
          autoComplete="off"
          disabled={disabled}
          placeholder={which === "start" ? startPlaceholder : endPlaceholder}
          value={which === "start" ? startText : endText}
          className={cn(BARE_INPUT_CLASS, "h-[22px] tabular-nums")}
          onFocus={() => openPanel(which)}
          onMouseDown={() => openPanel(which)}
          onChange={(event) => {
            setTyped({ side: which, text: event.target.value });
            const parsed = parseTyped(event.target.value, precision);
            if (parsed) setView({ year: parsed.year, month: parsed.month });
          }}
          onBlur={(event) => {
            if (floatingRef.current?.contains(event.relatedTarget as Node | null)) return;
            commitTyped();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (typed) {
                // Enter on a typed date: a complete range commits and closes; a typed start moves on to the end.
                if (commitTyped()) closePanel();
                else if (which === "start") {
                  setSide("end");
                  endInputRef.current?.focus();
                }
              } else {
                confirmSide();
              }
            } else if (event.key === "Tab" && which === "end") {
              commitTyped();
              closePanel();
            }
          }}
        />
        {visible && side === which ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-[5px] h-0.5 rounded-full bg-brand" />
        ) : null}
      </span>
    );
  }

  return (
    <div
      ref={frameRef}
      className={cn(
        controlFrameClass({ size, status, variant, disabled, active: visible, fixedHeight: true }),
        "group gap-2",
        CONTROL_PADDING_X[size],
        className,
      )}
      onMouseDown={(event) => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        if (disabled) return;
        if (event.target instanceof Element && event.target.closest("[data-picker-ignore]")) return;
        if (!(event.target instanceof HTMLInputElement)) {
          event.preventDefault();
          const which: Side = side === "end" && visible ? "end" : "start";
          (which === "end" ? endInputRef : startInputRef).current?.focus();
          openPanel(which);
        }
      }}
    >
      {inputFor("start")}
      <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-text-placeholder" />
      {inputFor("end")}
      <span className="relative flex size-4 shrink-0 items-center justify-center text-text-placeholder">
        <CalendarDays className={cn("size-3.5 transition-opacity", showClear && "group-hover:opacity-0")} />
        {showClear ? (
          <button
            type="button"
            data-picker-ignore=""
            tabIndex={-1}
            aria-label="清除"
            className="absolute inset-0 flex items-center justify-center bg-card text-text-placeholder opacity-0 transition-opacity hover:text-text-tertiary group-hover:opacity-100"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              commit(null, null);
              closePanel();
            }}
          >
            <CircleX className="size-3.5" />
          </button>
        ) : null}
      </span>

      <FloatingLayer
        open={visible && !disabled}
        layerId={layerId}
        floatingRef={floatingRef}
        style={position.style}
        placement={position.placement}
        role="dialog"
        aria-label="选择日期范围"
        className={cn(FLOATING_PANEL_CLASS, "max-w-[calc(100vw-16px)] overflow-hidden")}
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="flex">
          {presets?.length ? (
            <div className="flex w-24 shrink-0 flex-col gap-0.5 border-r border-border-secondary p-2">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  tabIndex={-1}
                  className="rounded-sm px-2 py-1 text-left text-sm text-brand hover:bg-brand-soft"
                  onClick={() => {
                    const [start, end] = preset.value();
                    commit(parseDateValue(start), parseDateValue(end));
                    closePanel();
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
          <CalendarPanel
            viewYear={viewYear}
            viewMonth={viewMonth}
            onViewChange={(year, month) => setView({ year, month })}
            today={today}
            rangeStart={draftStart}
            rangeEnd={draftEnd}
            hoverDay={isDateOnly ? hoverDay : null}
            onHoverDay={setHoverDay}
            isDisabled={disabledDate}
            onPick={pickDay}
            hideNext={showDual}
          />
          {showDual ? (
            <CalendarPanel
              key={`${viewYear}-${viewMonth}`}
              viewYear={viewMonth === 12 ? viewYear + 1 : viewYear}
              viewMonth={viewMonth === 12 ? 1 : viewMonth + 1}
              onViewChange={(year, month) =>
                setView(month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 })
              }
              today={today}
              rangeStart={draftStart}
              rangeEnd={draftEnd}
              hoverDay={hoverDay}
              onHoverDay={setHoverDay}
              isDisabled={disabledDate}
              onPick={pickDay}
              hidePrev
              className="border-l border-border-secondary"
            />
          ) : null}
          {!isDateOnly ? (
            <TimeColumns
              value={timeValue}
              withSeconds={withSecondsOf(precision)}
              onChange={(next) => (side === "start" ? setDraftStart(next) : setDraftEnd(next))}
            />
          ) : null}
        </div>
        {!isDateOnly ? (
          <div className="flex h-10 items-center justify-between gap-2 border-t border-border-secondary px-3">
            <span className="text-xs text-text-tertiary">{side === "start" ? "设置开始时间" : "设置结束时间"}</span>
            <Button size="sm" disabled={side === "start" ? !draftStart : !draftEnd} onClick={confirmSide}>
              确定
            </Button>
          </div>
        ) : null}
      </FloatingLayer>
    </div>
  );
}
