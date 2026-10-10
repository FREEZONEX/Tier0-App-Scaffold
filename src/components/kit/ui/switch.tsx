"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/components/kit/ui/floating";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Spinner in the knob while a toggle request is in flight. */
  loading?: boolean;
  size?: "sm" | "md";
  /** Text inside the track when on / off (e.g. 开 / 关). */
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
  className?: string;
  id?: string;
  title?: string;
  "aria-label"?: string;
}

export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  loading = false,
  size = "md",
  checkedChildren,
  unCheckedChildren,
  className,
  id,
  title,
  "aria-label": ariaLabel,
}: SwitchProps) {
  const [isOn, setOn] = useControllableState(checked, defaultChecked);
  const small = size === "sm";
  const inert = disabled || loading;

  return (
    <button
      type="button"
      id={id}
      role="switch"
      title={title}
      aria-label={ariaLabel}
      aria-checked={isOn}
      aria-busy={loading || undefined}
      disabled={inert}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full align-middle transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-border",
        small ? "h-4 min-w-7" : "h-[22px] min-w-11",
        isOn ? "bg-brand hover:bg-brand-hover" : "bg-[rgb(0_0_0/0.25)] hover:bg-[rgb(0_0_0/0.45)]",
        inert && "cursor-not-allowed opacity-60 hover:bg-[inherit]",
        className,
      )}
      onClick={() => {
        const next = !isOn;
        setOn(next);
        onChange?.(next);
      }}
    >
      <span
        className={cn(
          "flex items-center whitespace-nowrap text-xs text-white transition-[padding] duration-200",
          small ? "h-4 text-[10px]" : "h-[22px]",
          isOn ? (small ? "pl-1.5 pr-5" : "pl-2 pr-7") : small ? "pl-5 pr-1.5" : "pl-7 pr-2",
        )}
      >
        {isOn ? checkedChildren : unCheckedChildren}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 flex items-center justify-center rounded-full bg-white shadow-[0_2px_4px_0_rgb(0_35_11/0.2)] transition-[left] duration-200",
          small ? "size-3" : "size-[18px]",
          isOn ? (small ? "left-[calc(100%-14px)]" : "left-[calc(100%-20px)]") : "left-0.5",
        )}
      >
        {loading ? (
          <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-brand border-r-transparent" />
        ) : null}
      </span>
    </button>
  );
}
