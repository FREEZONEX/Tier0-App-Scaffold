"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface RecordSelectOption {
  value: string;
  label: string;
  description?: string;
  status?: string;
  quantity?: string | number;
  location?: string;
  date?: string;
  disabled?: boolean;
}

export interface RecordSelectMetaLabels {
  status?: string;
  quantity?: string;
  location?: string;
  date?: string;
}

export interface RecordSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: RecordSelectOption[];
  placeholder?: string;
  metaLabels?: RecordSelectMetaLabels;
}

const DEFAULT_META_LABELS: Required<RecordSelectMetaLabels> = {
  status: "status",
  quantity: "qty",
  location: "location",
  date: "date",
};

export function formatRecordOptionLabel(
  option: RecordSelectOption,
  metaLabels: RecordSelectMetaLabels = {},
) {
  const labels = { ...DEFAULT_META_LABELS, ...metaLabels };
  const meta = [
    option.description,
    option.status ? `${labels.status} ${option.status}` : undefined,
    option.quantity !== undefined
      ? `${labels.quantity} ${option.quantity}`
      : undefined,
    option.location ? `${labels.location} ${option.location}` : undefined,
    option.date ? `${labels.date} ${option.date}` : undefined,
  ].filter(Boolean);

  return meta.length > 0 ? `${option.label} - ${meta.join(" / ")}` : option.label;
}

export function RecordSelect({
  options,
  placeholder = "Select record",
  metaLabels,
  className,
  ...props
}: RecordSelectProps) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full min-w-0 rounded-sm border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] duration-150 disabled:bg-surface-inset disabled:text-muted-foreground focus:border-highlight focus:ring-2 focus:ring-highlight/20",
        className,
      )}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {formatRecordOptionLabel(option, metaLabels)}
        </option>
      ))}
    </select>
  );
}
