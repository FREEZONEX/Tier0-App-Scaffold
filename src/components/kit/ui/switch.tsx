"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/components/kit/ui/floating";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md";
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
  className?: string;
  id?: string;
  title?: string;
  "aria-label"?: string;
}

/** Switch — ReUI thumb recipe; checked fill uses Tier0 marketing lime. */
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
  const label = isOn ? checkedChildren : unCheckedChildren;

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
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent outline-none before:absolute before:-inset-y-3 before:-inset-x-1",
        "transition-[background-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
        "focus-visible:brightness-90",
        small ? "h-3.5 w-6" : "h-[18px] w-8",
        isOn
          ? "bg-[color:var(--tier0-highlight)] shadow-[inset_0_0_0_1px_rgb(115_178_0/0.15)]"
          : "bg-[color:var(--tier0-text-placeholder)] shadow-[inset_0_0_0_1px_rgb(5_11_20/0.08)]",
        inert && "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={() => {
        const next = !isOn;
        setOn(next);
        onChange?.(next);
      }}
    >
      {label ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 flex items-center text-[9px] font-medium",
            isOn
              ? "left-1 text-[color:var(--tier0-highlight-foreground)]"
              : "right-1 text-muted-foreground",
          )}
        >
          {label}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none flex items-center justify-center rounded-full bg-white shadow-sm ring-0",
          "transition-transform duration-[var(--motion-base)] ease-[var(--motion-spring)]",
          "motion-reduce:transition-none",
          small ? "size-3" : "size-4",
          isOn ? "translate-x-[calc(100%-2px)]" : "translate-x-0.5",
        )}
      >
        {loading ? (
          <LoaderCircle className="size-2.5 animate-spin text-muted-foreground" />
        ) : null}
      </span>
    </button>
  );
}
