import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  StatusBadge,
  statusTone,
  type StatusTone,
} from "./status-badge";

export interface OperationalListItem {
  id: string | number;
  title: ReactNode;
  /** Document, lot, asset, or location identifier. */
  code?: ReactNode;
  /** One short operational fact or consequence, not page guidance. */
  detail?: ReactNode;
  /** Secondary context such as owner, due time, location, or quantity. */
  meta?: ReactNode;
  status?: string;
  /** Omit to derive a semantic tone from `status`. */
  tone?: StatusTone;
  /** Link or compact Button leading to the affected workflow. */
  action?: ReactNode;
}

export interface OperationalListProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  summary?: ReactNode;
  headerAction?: ReactNode;
  items: readonly OperationalListItem[];
  /** Prefer the shared EmptyState when the empty case needs an action. */
  empty?: ReactNode;
}

const railClass: Record<StatusTone, string> = {
  running: "border-l-[color:var(--state-running-fg)]",
  idle: "border-l-border-strong",
  paused: "border-l-[color:var(--state-paused-fg)]",
  error: "border-l-[color:var(--state-error-fg)]",
  info: "border-l-[color:var(--state-info-fg)]",
};

/**
 * OperationalList — a compact, responsive queue for actionable records.
 * It prevents a few risk lines from becoming a tall empty card while keeping
 * status, consequence, and the next action visible together.
 */
export function OperationalList({
  title,
  summary,
  headerAction,
  items,
  empty,
  className,
  ...props
}: OperationalListProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border-secondary px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="typo-label truncate text-foreground">{title}</h2>
          {summary && <span className="caption shrink-0">{summary}</span>}
        </div>
        {headerAction && (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {headerAction}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-5 text-sm text-muted-foreground">
          {empty ?? <span aria-hidden="true">—</span>}
        </div>
      ) : (
        <div className="divide-y divide-border-secondary">
          {items.map((item) => {
            const tone = item.tone ?? statusTone(item.status);
            return (
              <div
                key={item.id}
                className={cn(
                  "grid min-w-0 gap-3 border-l-[3px] px-4 py-3 transition-colors hover:bg-surface-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                  railClass[tone],
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="typo-label min-w-0 text-foreground">
                      {item.title}
                    </span>
                    {item.code && (
                      <span className="caption font-mono text-foreground">
                        {item.code}
                      </span>
                    )}
                  </div>
                  {item.detail && (
                    <div className="mt-1 text-sm text-foreground">
                      {item.detail}
                    </div>
                  )}
                  {item.meta && <div className="caption mt-1">{item.meta}</div>}
                </div>

                {(item.status || item.action) && (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {item.status && (
                      <StatusBadge status={item.status} tone={tone} />
                    )}
                    {item.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
