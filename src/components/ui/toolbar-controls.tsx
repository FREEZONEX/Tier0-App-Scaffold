"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CapsuleGroup } from "@/components/kit/ui/tabs";
import { Select } from "@/components/kit/ui/select";
import { Tooltip } from "@/components/kit/ui/tooltip";

export interface StatusFilterItem<K extends string = string> {
  key: K;
  label: string;
  count?: number;
}

/**
 * StatusFilter — one-row status filter for list toolbars. Up to three options
 * render as inline pills; four or more fold into a compact dropdown (with
 * counts) so the toolbar keeps search, filter and view switch on one line.
 */
export function StatusFilter<K extends string = string>({
  items,
  value,
  onChange,
  label = "状态筛选",
  className,
}: {
  items: StatusFilterItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Accessible name of the control. */
  label?: string;
  className?: string;
}) {
  if (items.length <= 3) {
    return (
      <CapsuleGroup<K>
        value={value}
        onChange={onChange}
        items={items.map((item) => ({ key: item.key, label: item.label, count: item.count }))}
        className={className}
      />
    );
  }
  return (
    <Select<K>
      aria-label={label}
      value={value}
      onChange={(next) => onChange(next as K)}
      options={items.map((item) => ({
        value: item.key,
        label: item.count === undefined ? item.label : `${item.label} · ${item.count}`,
      }))}
      className={cn("w-36 shrink-0", className)}
    />
  );
}

export interface ViewToggleItem<V extends string = string> {
  value: V;
  /** Accessible name and tooltip, e.g. "看板". */
  label: string;
  icon: ReactNode;
}

/** ViewToggle — icon-only segmented switch (board / list / map …). */
export function ViewToggle<V extends string = string>({
  items,
  value,
  onChange,
  label = "视图",
  className,
}: {
  items: ViewToggleItem<V>[];
  value: V;
  onChange: (value: V) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-[var(--tier0-control-height-md)] shrink-0 items-stretch overflow-hidden rounded-[4px] border border-input bg-card shadow-xs",
        className,
      )}
    >
      {items.map((item, index) => (
        <Tooltip key={item.value} title={item.label} anchorClassName="flex">
          <button
            type="button"
            aria-label={item.label}
            aria-pressed={value === item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex aspect-square h-full items-center justify-center text-muted-foreground outline-none",
              "transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
              "hover:bg-fill-hover hover:text-foreground focus-visible:bg-fill-hover focus-visible:text-foreground",
              "aria-pressed:bg-highlight-bg-accent aria-pressed:text-foreground [&_svg]:size-4",
              index > 0 && "border-l border-input",
            )}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
