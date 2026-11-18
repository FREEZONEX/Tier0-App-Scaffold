import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThinkingLoader } from "@/components/ui/thinking-loader";
import { cn } from "@/lib/utils";

export type ChatStatusState = "waiting" | "error";

export interface ChatRetrievalItem {
  id: string;
  label: string;
  state: "queued" | "read" | "used";
}

export interface ChatStatusProps {
  state: ChatStatusState;
  /** Business line, e.g. "正在查 SOP-扭矩校准". */
  label: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * ChatStatus — first-token wait or a failed turn with retry.
 * Waiting uses ThinkingLoader (ray spark + shimmer), not a page Skeleton.
 */
export function ChatStatus({
  state,
  label,
  onRetry,
  retryLabel = "重试",
  className,
}: ChatStatusProps) {
  if (state === "waiting") {
    const text = typeof label === "string" ? label : undefined;
    return (
      <div data-slot="chat-status" data-state="waiting" className={className}>
        <ThinkingLoader
          variant="plain"
          size="sm"
          phases={text ? [text, "对照工艺", "整理回答"] : undefined}
        />
      </div>
    );
  }

  return (
    <div
      data-slot="chat-status"
      data-state="error"
      className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
    >
      <p className="text-sm text-destructive">{label}</p>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

const STATE_LABEL = {
  queued: "排队",
  read: "已读",
  used: "已引用",
} as const;

export function ChatRetrieval({
  items,
  className,
}: {
  items: ChatRetrievalItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <ul
      data-slot="chat-retrieval"
      className={cn("flex w-fit max-w-full min-w-0 flex-col gap-1", className)}
    >
      {items.map((item) => (
        <li
          key={item.id}
          data-state={item.state}
          className="flex items-center gap-2 text-xs leading-5"
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              item.state === "queued" && "border border-border bg-transparent",
              item.state === "read" && "bg-muted-foreground/45",
              item.state === "used" && "bg-foreground",
            )}
          />
          <span
            className={cn(
              "min-w-0 truncate",
              item.state === "queued" && "text-muted-foreground",
            )}
          >
            {item.label}
          </span>
          <span className="shrink-0 text-muted-foreground">{STATE_LABEL[item.state]}</span>
        </li>
      ))}
    </ul>
  );
}
