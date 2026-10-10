"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BARE_INPUT_CLASS,
  CONTROL_PADDING_X,
  controlFrameClass,
  type ControlSize,
  type ControlStatus,
  type ControlVariant,
} from "@/components/kit/ui/control-styles";
import { useControllableState } from "@/components/kit/ui/floating";
import {
  clampNumber,
  formatNumber,
  isTypingNumber,
  parseNumberText,
  roundTo,
} from "@/components/kit/ui/number-utils";

export interface NumberInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "size" | "value" | "defaultValue" | "onChange" | "prefix" | "min" | "max" | "step" | "type"
  > {
  value?: number | null;
  defaultValue?: number | null;
  /** Emits parsed numbers while typing and the normalized value on blur. */
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Arrow-key / stepper increment (default 1). */
  step?: number;
  /** Maximum decimal places; input beyond it is rejected, values are rounded. */
  precision?: number;
  /** Pad decimals to `precision` when not focused (金额 12.50). */
  fixedDecimals?: boolean;
  /** Show thousands separators when not focused. */
  thousandSeparator?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: ControlSize;
  status?: ControlStatus;
  variant?: ControlVariant;
  allowClear?: boolean;
  /** Text alignment (numbers in table cells read better right-aligned). */
  align?: "left" | "right";
  /** Up/down stepper buttons on hover. */
  controls?: boolean;
  onPressEnter?: (event: KeyboardEvent<HTMLInputElement>) => void;
  wrapperClassName?: string;
  inputClassName?: string;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    defaultValue = null,
    onChange,
    min,
    max,
    step = 1,
    precision,
    fixedDecimals = false,
    thousandSeparator = false,
    prefix,
    suffix,
    size = "md",
    status,
    variant = "outlined",
    allowClear = false,
    align = "left",
    controls = false,
    onPressEnter,
    disabled = false,
    readOnly = false,
    className,
    wrapperClassName,
    inputClassName,
    onFocus,
    onBlur,
    onKeyDown,
    placeholder = "请输入",
    ...rest
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [current, setCurrent] = useControllableState<number | null>(
    value === undefined ? undefined : value,
    defaultValue,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const allowNegative = min === undefined || min < 0;

  const display =
    draft ?? formatNumber(current, { precision, fixedDecimals, thousandSeparator });

  function emit(next: number | null) {
    if (next === current) return;
    setCurrent(next);
    onChange?.(next);
  }

  function normalize(next: number): number {
    const rounded = precision === undefined ? next : roundTo(next, precision);
    return clampNumber(rounded, min, max);
  }

  function commit() {
    if (draft === null) return;
    const parsed = parseNumberText(draft);
    setDraft(null);
    emit(parsed === null ? null : normalize(parsed));
  }

  function stepBy(direction: 1 | -1) {
    if (disabled || readOnly) return;
    const base = parseNumberText(draft ?? "") ?? current ?? 0;
    const next = normalize(base + direction * step);
    if (draft !== null) setDraft(formatNumber(next, { precision, fixedDecimals }));
    emit(next);
  }

  const canClear = allowClear && !disabled && !readOnly && display !== "";

  return (
    <span
      className={cn(
        controlFrameClass({ size, status, variant, disabled }),
        variant !== "borderless" && "tier0-text-field",
        "group gap-1",
        CONTROL_PADDING_X[size],
        controls && "pr-0",
        wrapperClassName,
        className,
      )}
      onMouseDown={(event) => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
        if (event.target !== inputRef.current && !disabled) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      {prefix ? (
        <span className="flex shrink-0 items-center text-text-tertiary [&>svg]:size-3.5">{prefix}</span>
      ) : null}
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode={precision === 0 ? "numeric" : "decimal"}
        data-bare-control=""
        autoComplete="off"
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current ?? undefined}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        value={display}
        className={cn(
          BARE_INPUT_CLASS,
          "h-[22px] tabular-nums",
          align === "right" && "text-right",
          inputClassName,
        )}
        onFocus={(event) => {
          if (!readOnly) setDraft(formatNumber(current, { precision, fixedDecimals }));
          onFocus?.(event);
        }}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        onChange={(event) => {
          const nextText = event.target.value;
          if (!isTypingNumber(nextText, { allowNegative, precision })) return;
          setDraft(nextText);
          const parsed = parseNumberText(nextText);
          if (nextText.trim() === "") emit(null);
          else if (parsed !== null) emit(parsed);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            stepBy(1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            stepBy(-1);
          } else if (event.key === "Enter") {
            commit();
            onPressEnter?.(event);
          }
        }}
      />
      {canClear ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="清除"
          className="flex shrink-0 items-center text-text-placeholder opacity-0 transition-opacity hover:text-text-tertiary group-focus-within:opacity-100 group-hover:opacity-100"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setDraft(null);
            emit(null);
          }}
        >
          <CircleX className="size-3.5" />
        </button>
      ) : null}
      {suffix ? (
        <span className="flex shrink-0 items-center text-text-tertiary [&>svg]:size-3.5">{suffix}</span>
      ) : null}
      {controls && !disabled && !readOnly ? (
        <span className="ml-1 flex h-full w-5 shrink-0 flex-col self-stretch border-l border-border-secondary opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            tabIndex={-1}
            aria-label="增加"
            className="flex flex-1 items-center justify-center text-text-tertiary hover:bg-fill-hover hover:text-brand"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stepBy(1)}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="减少"
            className="flex flex-1 items-center justify-center border-t border-border-secondary text-text-tertiary hover:bg-fill-hover hover:text-brand"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stepBy(-1)}
          >
            <ChevronDown className="size-3" />
          </button>
        </span>
      ) : null}
    </span>
  );
});

export type NumberRange = [number | null, number | null];

export interface NumberRangeInputProps {
  value?: NumberRange | null;
  /** Emits null when both ends are empty. */
  onChange?: (value: NumberRange | null) => void;
  placeholder?: [string, string];
  min?: number;
  max?: number;
  precision?: number;
  size?: ControlSize;
  status?: ControlStatus;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** NumberRangeInput — 最小值 ~ 最大值 in one frame (查询区数字区间). */
export function NumberRangeInput({
  value,
  onChange,
  placeholder = ["最小值", "最大值"],
  min,
  max,
  precision,
  size = "md",
  status,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: NumberRangeInputProps) {
  const [range, setRange] = useControllableState<NumberRange | null>(value, null, onChange);
  const [from, to] = range ?? [null, null];

  function update(next: NumberRange) {
    setRange(next[0] === null && next[1] === null ? null : next);
  }

  const bareClass =
    "min-w-0 flex-1 px-0 hover:bg-transparent focus-within:bg-transparent focus-within:shadow-none";

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      className={cn(
        controlFrameClass({ size, status, disabled }),
        "gap-1",
        CONTROL_PADDING_X[size],
        className,
      )}
    >
      <NumberInput
        variant="borderless"
        size={size}
        value={from}
        min={min}
        max={max}
        precision={precision}
        disabled={disabled}
        placeholder={placeholder[0]}
        aria-label={placeholder[0]}
        className={bareClass}
        onChange={(next) => update([next, to])}
      />
      <span aria-hidden="true" className="shrink-0 px-1 text-text-placeholder">
        ~
      </span>
      <NumberInput
        variant="borderless"
        size={size}
        value={to}
        min={min}
        max={max}
        precision={precision}
        disabled={disabled}
        placeholder={placeholder[1]}
        aria-label={placeholder[1]}
        className={bareClass}
        onChange={(next) => update([from, next])}
      />
    </span>
  );
}
