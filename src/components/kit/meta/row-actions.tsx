"use client";

/**
 * RowActions — 操作列.
 *
 * Prefer icons (`action.icon`): fixed-size IconButtons keep every row's ⋯ in
 * the same column. Text labels are the fallback when no icon is given. A
 * reserved ⋯ slot is always measured so rows without overflow still align.
 */
import type { MouseEvent } from "react";
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

function InlineAction({ action }: { action: RowAction }) {
  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    action.onClick();
  };

  const button = action.icon ? (
    <IconButton
      size="sm"
      label={action.label}
      icon={action.icon}
      danger={Boolean(action.danger) || action.tone === "danger"}
      disabled={action.disabled}
      className={cn(
        !action.danger && action.tone === "success" && "text-success-deep hover:text-success",
        !action.danger && action.tone === "warning" && "text-warning-deep hover:text-warning",
        !action.danger && (action.tone === "primary" || !action.tone) && "text-primary hover:text-primary/80",
      )}
      onClick={onClick}
    />
  ) : (
    <TextButton tone={toneOf(action)} disabled={action.disabled} onClick={onClick}>
      {action.label}
    </TextButton>
  );

  if (action.disabled && action.disabledReason) {
    return (
      <Tooltip title={action.disabledReason}>
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  }
  return button;
}

export function RowActions({ actions, inlineCount = 2, className }: RowActionsProps) {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return <span className="text-text-tertiary">-</span>;
  const inline = visible.slice(0, inlineCount);
  const rest = visible.slice(inlineCount);

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1 whitespace-nowrap", className)}
      data-grid-no-row-click=""
    >
      {inline.map((action) => (
        <InlineAction key={action.key} action={action} />
      ))}
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
          <IconButton
            size="sm"
            label="更多操作"
            tooltip={false}
            icon={<Ellipsis />}
            className="text-muted-foreground hover:text-foreground"
          />
        </DropdownMenu>
      ) : (
        /* Keep the ⋯ column so icon rows stay aligned across the table. */
        <span className="inline-flex size-7 shrink-0" aria-hidden="true" />
      )}
    </span>
  );
}
