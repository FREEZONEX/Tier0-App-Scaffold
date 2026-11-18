"use client";

import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChatActionStatus = "pending" | "done" | "dismissed";

export interface ChatActionDetail {
  label: string;
  value: ReactNode;
}

export interface ChatActionConfirm {
  title: string;
  description: string;
}

export interface ChatActionPanelProps {
  title: ReactNode;
  description?: ReactNode;
  details?: ChatActionDetail[];
  status?: ChatActionStatus;
  /** Primary verb, e.g. "隔离本工位件". One primary per panel. */
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
  /** When set, the primary click opens ConfirmDialog first. */
  confirm?: ChatActionConfirm;
  destructive?: boolean;
  /** Extra outline actions (写入草稿). */
  secondary?: ReactNode;
  dismissLabel?: string;
  onDismiss?: () => void;
  doneLabel?: ReactNode;
  dismissedLabel?: ReactNode;
  pending?: boolean;
  className?: string;
}

/**
 * ChatActionPanel — operator commands attached to a reply. Mapped from
 * affectUI approval-card: preview + decide, without countdown or "always allow".
 * Irreversible verbs go through ConfirmDialog.
 */
export function ChatActionPanel({
  title,
  description,
  details,
  status = "pending",
  primaryLabel,
  onPrimary,
  confirm,
  destructive = false,
  secondary,
  dismissLabel = "取消",
  onDismiss,
  doneLabel,
  dismissedLabel,
  pending = false,
  className,
}: ChatActionPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = pending || busy;

  const runPrimary = async () => {
    setBusy(true);
    try {
      await onPrimary();
    } finally {
      setBusy(false);
    }
  };

  if (status === "done") {
    return (
      <p
        data-slot="chat-action-panel"
        data-status="done"
        className={cn("text-xs leading-5 text-muted-foreground", className)}
      >
        {doneLabel ?? `已${primaryLabel}`}
      </p>
    );
  }

  if (status === "dismissed") {
    return (
      <p
        data-slot="chat-action-panel"
        data-status="dismissed"
        className={cn("text-xs leading-5 text-muted-foreground", className)}
      >
        {dismissedLabel ?? "已取消此项"}
      </p>
    );
  }

  return (
    <div
      data-slot="chat-action-panel"
      data-status="pending"
      className={cn("min-w-0 overflow-hidden rounded-[4px] border border-border bg-card", className)}
    >
      <div className="space-y-2 px-3 py-2.5">
        <p className="text-sm font-medium leading-6">{title}</p>
        {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {details && details.length > 0 ? (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs leading-5">
            {details.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 truncate text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant={(destructive ? "danger" : "primary") as ButtonVariant}
          className="h-7 px-2.5 text-xs"
          loading={working}
          disabled={working}
          onClick={() => {
            if (confirm) setConfirmOpen(true);
            else void runPrimary();
          }}
        >
          {primaryLabel}
        </Button>
        {onDismiss ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            disabled={working}
            onClick={onDismiss}
          >
            {dismissLabel}
          </Button>
        ) : null}
        {secondary}
      </div>
      {confirm ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={primaryLabel}
          destructive={destructive}
          pending={working}
          onConfirm={async () => {
            await runPrimary();
            setConfirmOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
