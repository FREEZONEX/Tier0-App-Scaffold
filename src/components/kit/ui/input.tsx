"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BARE_INPUT_CLASS,
  CONTROL_PADDING_X,
  controlFrameClass,
  type ControlSize,
  type ControlStatus,
  type ControlVariant,
} from "@/components/kit/ui/control-styles";
import { useControllableState, useIsoLayoutEffect } from "@/components/kit/ui/floating";

function toText(value: string | number | null | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "";
  return String(value);
}

export interface InputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "size" | "value" | "defaultValue" | "onChange" | "prefix"
  > {
  value?: string | number | null;
  defaultValue?: string;
  /** Receives the new text; `event` is null when cleared via the × button. */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement> | null) => void;
  size?: ControlSize;
  status?: ControlStatus;
  variant?: ControlVariant;
  /** Show a × button while the input has a value. */
  allowClear?: boolean;
  onClear?: () => void;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Show "length / maxLength" inside the frame. */
  showCount?: boolean;
  onPressEnter?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Class for the outer frame (`className` also targets the frame). */
  wrapperClassName?: string;
  /** Class for the inner native <input>. */
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value,
    defaultValue = "",
    onChange,
    size = "md",
    status,
    variant = "outlined",
    allowClear = false,
    onClear,
    prefix,
    suffix,
    showCount = false,
    onPressEnter,
    onKeyDown,
    className,
    wrapperClassName,
    inputClassName,
    disabled = false,
    readOnly = false,
    maxLength,
    type = "text",
    ...rest
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [text, setText] = useControllableState(toText(value), defaultValue);
  const canClear = allowClear && !disabled && !readOnly && text.length > 0;

  return (
    <span
      className={cn(
        controlFrameClass({ size, status, variant, disabled }),
        variant !== "borderless" && "tier0-text-field",
        "group gap-1",
        CONTROL_PADDING_X[size],
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
        type={type}
        data-bare-control=""
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        className={cn(BARE_INPUT_CLASS, "h-[22px]", inputClassName)}
        onChange={(event) => {
          setText(event.target.value);
          onChange?.(event.target.value, event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Enter" && !event.nativeEvent.isComposing) onPressEnter?.(event);
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
            setText("");
            onChange?.("", null);
            onClear?.();
            inputRef.current?.focus();
          }}
        >
          <CircleX className="size-3.5" />
        </button>
      ) : null}
      {showCount ? (
        <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
          {maxLength !== undefined ? `${text.length} / ${maxLength}` : text.length}
        </span>
      ) : null}
      {suffix ? (
        <span className="flex shrink-0 items-center text-text-tertiary [&>svg]:size-3.5">{suffix}</span>
      ) : null}
    </span>
  );
});

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange"> {
  value?: string | null;
  defaultValue?: string;
  onChange?: (value: string, event: ChangeEvent<HTMLTextAreaElement>) => void;
  status?: ControlStatus;
  variant?: ControlVariant;
  /** Show "0 / 1000" under the box (default: when maxLength is set). */
  showCount?: boolean;
  /** Grow with content between minRows and maxRows. */
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  resize?: "none" | "vertical";
  /** Class for the wrapper (textarea + count). */
  wrapperClassName?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    value,
    defaultValue = "",
    onChange,
    status,
    variant = "outlined",
    showCount,
    maxLength,
    autoSize = false,
    resize = "vertical",
    rows = 3,
    disabled = false,
    className,
    wrapperClassName,
    ...rest
  },
  ref,
) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => areaRef.current as HTMLTextAreaElement);
  const [text, setText] = useControllableState(toText(value), defaultValue);
  const countVisible = showCount ?? maxLength !== undefined;
  const autoRows = autoSize === true ? {} : autoSize || null;

  useIsoLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || !autoRows) return;
    const lineHeight = 22;
    const verticalPadding = 12;
    const minHeight = (autoRows.minRows ?? rows) * lineHeight + verticalPadding;
    const maxHeight = autoRows.maxRows ? autoRows.maxRows * lineHeight + verticalPadding : Infinity;
    area.style.removeProperty("height");
    const next = Math.min(Math.max(area.scrollHeight + 2, minHeight), maxHeight);
    area.style.height = `${next}px`;
    area.style.overflowY = area.scrollHeight + 2 > maxHeight ? "scroll" : "hidden";
  }, [text, autoRows?.minRows, autoRows?.maxRows, rows]);

  return (
    <div className={cn("w-full min-w-0", wrapperClassName)}>
      <textarea
        {...rest}
        ref={areaRef}
        data-bare-control=""
        rows={rows}
        value={text}
        maxLength={maxLength}
        disabled={disabled}
        className={cn(
          controlFrameClass({ status, variant, disabled }),
          "block min-h-0 px-[11px] py-[5px] leading-[22px] outline-none placeholder:text-text-placeholder",
          resize === "none" || autoRows ? "resize-none" : "resize-y",
          className,
        )}
        onChange={(event) => {
          setText(event.target.value);
          onChange?.(event.target.value, event);
        }}
      />
      {countVisible ? (
        <div className="mt-1 text-right text-xs tabular-nums leading-5 text-text-tertiary">
          {maxLength !== undefined ? `${text.length} / ${maxLength}` : text.length}
        </div>
      ) : null}
    </div>
  );
});
