"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/components/kit/ui/floating";
import type { OptionItem } from "@/components/kit/ui/types";

export interface CheckboxIndicatorProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Presentational 16px checkbox square (used inside option rows and tables). */
export function CheckboxIndicator({
  checked = false,
  indeterminate = false,
  disabled = false,
  className,
}: CheckboxIndicatorProps) {
  const filled = checked && !indeterminate;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-[background-color,border-color] duration-150",
        filled ? "border-brand bg-brand" : "border-border-strong bg-card",
        disabled && (filled ? "border-border-strong bg-input-disabled" : "border-border-strong bg-input-disabled"),
        className,
      )}
    >
      {filled ? (
        <Check
          className={cn("size-3", disabled ? "text-text-placeholder" : "text-white")}
          strokeWidth={3.2}
        />
      ) : null}
      {indeterminate ? (
        <span className={cn("size-2 rounded-[2px]", disabled ? "bg-text-placeholder" : "bg-brand")} />
      ) : null}
    </span>
  );
}

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "size" | "checked" | "defaultChecked"> {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Half-checked look (e.g. header checkbox with some rows selected). */
  indeterminate?: boolean;
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  /** Label text. */
  children?: ReactNode;
  /** Class for the outer <label>. */
  className?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked, defaultChecked = false, indeterminate = false, onChange, disabled, children, className, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [isChecked, setChecked] = useControllableState(checked, defaultChecked);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      data-required-rendered="true"
      className={cn(
        "group inline-flex max-w-full items-center gap-2 align-middle text-sm leading-[22px] text-foreground",
        disabled ? "cursor-not-allowed text-text-placeholder" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative inline-flex size-4 shrink-0">
        <input
          {...rest}
          ref={inputRef}
          type="checkbox"
          checked={isChecked}
          disabled={disabled}
          aria-checked={indeterminate ? "mixed" : isChecked}
          className="peer absolute inset-0 z-10 m-0 size-full cursor-[inherit] opacity-0"
          onChange={(event) => {
            setChecked(event.target.checked);
            onChange?.(event.target.checked, event);
          }}
        />
        <CheckboxIndicator
          checked={isChecked}
          indeterminate={indeterminate}
          disabled={disabled}
          className={cn(
            "peer-focus-visible:shadow-[0_0_0_2px_rgb(5_145_255/0.25)]",
            !disabled && !isChecked && !indeterminate && "group-hover:border-brand",
          )}
        />
      </span>
      {children !== undefined && children !== null ? <span className="min-w-0">{children}</span> : null}
    </label>
  );
});

export interface CheckboxGroupProps<V extends string | number = string | number> {
  options: OptionItem<V>[];
  value?: V[] | null;
  defaultValue?: V[];
  onChange?: (value: V[]) => void;
  disabled?: boolean;
  direction?: "horizontal" | "vertical";
  className?: string;
  "aria-label"?: string;
}

export function CheckboxGroup<V extends string | number = string | number>({
  options,
  value,
  defaultValue = [],
  onChange,
  disabled = false,
  direction = "horizontal",
  className,
  "aria-label": ariaLabel,
}: CheckboxGroupProps<V>) {
  const [selected, setSelected] = useControllableState<V[]>(
    value === null ? [] : value,
    defaultValue,
    onChange,
  );

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex min-w-0",
        direction === "vertical" ? "flex-col gap-2" : "flex-wrap items-center gap-x-6 gap-y-2",
        className,
      )}
    >
      {options.map((option) => {
        const isChecked = selected.includes(option.value);
        return (
          <Checkbox
            key={String(option.value)}
            checked={isChecked}
            disabled={disabled || option.disabled}
            onChange={(next) => {
              const nextValues = options
                .map((item) => item.value)
                .filter((candidate) =>
                  candidate === option.value ? next : selected.includes(candidate),
                );
              setSelected(nextValues);
            }}
          >
            {option.label}
          </Checkbox>
        );
      })}
    </div>
  );
}
