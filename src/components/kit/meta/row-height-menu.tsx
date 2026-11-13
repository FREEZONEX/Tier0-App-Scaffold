"use client";

/** 行高: 低 / 中 / 高 dropdown; selecting applies and saves at once. */
import { Check, TextCursor } from "lucide-react";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { DropdownMenu } from "@/components/kit/ui/dropdown-menu";
import { ROW_HEIGHT_OPTIONS } from "@/lib/component-kit/list-columns";
import type { RowHeight } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

export interface RowHeightMenuProps {
  value: RowHeight;
  onChange: (rowHeight: RowHeight) => void;
  disabled?: boolean;
  /** Icon-only trigger for the list toolbar's 表格设置 group. */
  compact?: boolean;
}

function RowHeightGlyph({ value }: { value: RowHeight }) {
  const gap = value === "LOW" ? "gap-px" : value === "MID" ? "gap-[3px]" : "gap-[5px]";
  return (
    <span aria-hidden="true" className={cn("flex w-3.5 flex-col items-stretch", gap)}>
      <span className="h-px bg-current" />
      <span className="h-px bg-current" />
      <span className="h-px bg-current" />
    </span>
  );
}

export function RowHeightMenu({ value, onChange, disabled = false, compact = false }: RowHeightMenuProps) {
  return (
    <DropdownMenu
      placement="bottom-start"
      aria-label="行高"
      disabled={disabled}
      minWidth={96}
      items={ROW_HEIGHT_OPTIONS.map((option) => ({
        key: option.value,
        label: <span className={cn(option.value === value && "font-medium text-brand")}>{option.label}</span>,
        icon: <RowHeightGlyph value={option.value} />,
        extra: option.value === value ? <Check className="size-3.5 text-foreground" aria-hidden="true" /> : undefined,
        onClick: () => {
          if (option.value !== value) onChange(option.value);
        },
      }))}
    >
      {compact ? (
        <IconButton variant="outline" size="lg" icon={<TextCursor />} label="行高" title="行高" tooltip={false} disabled={disabled} />
      ) : (
        <TextButton tone="primary" icon={<TextCursor />} disabled={disabled}>
          行高
        </TextButton>
      )}
    </DropdownMenu>
  );
}
