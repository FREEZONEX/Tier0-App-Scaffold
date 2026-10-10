"use client";

/**
 * RowActions — 操作列: the first N visible actions inline (blue text; danger red;
 * disabled gray with reason tooltip), the rest in a ⋯ menu that opens on hover
 * (202_wo_row_more_running.png).
 */
import { Ellipsis } from "lucide-react";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { DropdownMenu } from "@/components/kit/ui/dropdown-menu";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RowAction } from "@/components/kit/meta/types";

export interface RowActionsProps {
  actions: readonly RowAction[];
  /** Inline actions before the ⋯ menu (default 2). */
  inlineCount?: number;
  className?: string;
}

function toneOf(action: RowAction) {
  if (action.danger) return "danger" as const;
  return action.tone ?? "primary";
}

export function RowActions({ actions, inlineCount = 2, className }: RowActionsProps) {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return <span className="text-text-tertiary">-</span>;
  const inline = visible.slice(0, inlineCount);
  const rest = visible.slice(inlineCount);

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-3 whitespace-nowrap", className)} data-grid-no-row-click="">
      {inline.map((action) => {
        const button = (
          <TextButton
            key={action.key}
            tone={toneOf(action)}
            disabled={action.disabled}
            onClick={(event) => {
              event.stopPropagation();
              action.onClick();
            }}
          >
            {action.label}
          </TextButton>
        );
        return action.disabled && action.disabledReason ? (
          <Tooltip key={action.key} title={action.disabledReason}>
            <span className="inline-flex">{button}</span>
          </Tooltip>
        ) : (
          button
        );
      })}
      {rest.length > 0 ? (
        <DropdownMenu
          trigger="hover"
          placement="bottom-end"
          minWidth={112}
          aria-label="更多操作"
          items={rest.map((action) => ({
            key: action.key,
            label: action.label,
            danger: action.danger,
            disabled: action.disabled,
            title: action.disabled ? action.disabledReason : undefined,
            onClick: action.onClick,
          }))}
        >
          <IconButton size="sm" label="更多操作" tooltip={false} icon={<Ellipsis />} className="text-text-secondary hover:text-brand" />
        </DropdownMenu>
      ) : null}
    </span>
  );
}
