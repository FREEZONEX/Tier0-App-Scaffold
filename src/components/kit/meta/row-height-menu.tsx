"use client";

/** 行高 (149_row_height.png): 低 / 中 / 高 dropdown; selecting applies and saves at once. */
import { Check, TextCursor } from "lucide-react";
import { TextButton } from "@/components/kit/ui/buttons";
import { DropdownMenu } from "@/components/kit/ui/dropdown-menu";
import { ROW_HEIGHT_OPTIONS } from "@/lib/component-kit/list-columns";
import type { RowHeight } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

export interface RowHeightMenuProps {
  value: RowHeight;
  onChange: (rowHeight: RowHeight) => void;
  disabled?: boolean;
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

export function RowHeightMenu({ value, onChange, disabled = false }: RowHeightMenuProps) {
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
        extra: option.value === value ? <Check className="size-3.5 text-brand" aria-hidden="true" /> : undefined,
        onClick: () => {
          if (option.value !== value) onChange(option.value);
        },
      }))}
    >
      <TextButton icon={<TextCursor />} disabled={disabled}>
        行高
      </TextButton>
    </DropdownMenu>
  );
}
