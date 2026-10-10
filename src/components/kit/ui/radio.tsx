"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { CONTROL_FIXED_HEIGHT, CONTROL_TEXT, type ControlSize } from "@/components/kit/ui/control-styles";
import { useControllableState } from "@/components/kit/ui/floating";
import type { OptionItem } from "@/components/kit/ui/types";

export interface RadioGroupProps<V extends string | number = string | number> {
  options: OptionItem<V>[];
  value?: V | null;
  defaultValue?: V | null;
  onChange?: (value: V) => void;
  /** default = round radios; button = joined buttons (「低 / 中 / 高」). */
  optionType?: "default" | "button";
  /** Button style: outline (blue border + text) or solid (blue fill). */
  buttonStyle?: "outline" | "solid";
  size?: ControlSize;
  disabled?: boolean;
  direction?: "horizontal" | "vertical";
  /** Buttons stretch to fill the width. */
  block?: boolean;
  name?: string;
  className?: string;
  "aria-label"?: string;
}

export function RadioGroup<V extends string | number = string | number>({
  options,
  value,
  defaultValue = null,
  onChange,
  optionType = "default",
  buttonStyle = "outline",
  size = "md",
  disabled = false,
  direction = "horizontal",
  block = false,
  name,
  className,
  "aria-label": ariaLabel,
}: RadioGroupProps<V>) {
  const generatedName = useId();
  const groupName = name ?? generatedName;
  const [selected, setSelected] = useControllableState<V | null>(value, defaultValue);

  function choose(next: V) {
    setSelected(next);
    onChange?.(next);
  }

  if (optionType === "button") {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn("inline-flex max-w-full items-stretch", block && "flex w-full", className)}
      >
        {options.map((option, index) => {
          const isSelected = selected !== null && String(selected) === String(option.value);
          const isDisabled = disabled || option.disabled;
          return (
            <label
              key={String(option.value)}
              data-required-rendered="true"
              className={cn(
                "relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap border px-[15px] transition-[color,background-color,border-color] duration-150",
                CONTROL_FIXED_HEIGHT[size],
                CONTROL_TEXT[size],
                size === "sm" && "px-[7px]",
                block && "flex-1",
                index > 0 && "-ml-px",
                index === 0 && (size === "lg" ? "rounded-l-lg" : size === "sm" ? "rounded-l-sm" : "rounded-l-md"),
                index === options.length - 1 &&
                  (size === "lg" ? "rounded-r-lg" : size === "sm" ? "rounded-r-sm" : "rounded-r-md"),
                isSelected
                  ? buttonStyle === "solid"
                    ? "z-10 border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover"
                    : "z-10 border-brand bg-card text-brand hover:border-brand-hover hover:text-brand-hover"
                  : "border-border-strong bg-card text-foreground hover:text-brand",
                isDisabled && "cursor-not-allowed border-border-strong bg-input-disabled text-text-placeholder hover:text-text-placeholder",
                !isDisabled && "cursor-pointer",
                "has-[:focus-visible]:shadow-[0_0_0_2px_rgb(5_145_255/0.2)]",
              )}
            >
              <input
                type="radio"
                name={groupName}
                className="absolute inset-0 m-0 cursor-[inherit] opacity-0"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => choose(option.value)}
              />
              {option.icon ? <span className="flex shrink-0 [&>svg]:size-4">{option.icon}</span> : null}
              {option.label}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex min-w-0",
        direction === "vertical" ? "flex-col gap-2" : "flex-wrap items-center gap-x-6 gap-y-2",
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = selected !== null && String(selected) === String(option.value);
        const isDisabled = disabled || option.disabled;
        return (
          <label
            key={String(option.value)}
            data-required-rendered="true"
            className={cn(
              "group inline-flex items-center gap-2 text-sm leading-[22px]",
              isDisabled ? "cursor-not-allowed text-text-placeholder" : "cursor-pointer text-foreground",
            )}
          >
            <span className="relative inline-flex size-4 shrink-0">
              <input
                type="radio"
                name={groupName}
                className="peer absolute inset-0 z-10 m-0 size-full cursor-[inherit] opacity-0"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => choose(option.value)}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border transition-colors duration-150 peer-focus-visible:shadow-[0_0_0_2px_rgb(5_145_255/0.25)]",
                  isSelected ? "border-brand bg-brand" : "border-border-strong bg-card",
                  !isDisabled && !isSelected && "group-hover:border-brand",
                  isDisabled && "border-border-strong bg-input-disabled",
                )}
              >
                {isSelected ? (
                  <span className={cn("size-1.5 rounded-full", isDisabled ? "bg-text-placeholder" : "bg-white")} />
                ) : null}
              </span>
            </span>
            <span className="min-w-0">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
