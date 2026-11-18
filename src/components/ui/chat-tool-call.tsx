"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSpark } from "@/components/ui/chat-spark";
import { cn } from "@/lib/utils";

export type ChatToolStatus = "running" | "done" | "error";

export interface ChatToolCallItem {
  id: string;
  /** Operator-facing title, e.g. "查告警字典". */
  title: string;
  /** Optional tool id shown in the fold. */
  name?: string;
  status: ChatToolStatus;
  input?: Record<string, string | number> | string;
  output?: Record<string, string | number> | string;
  error?: string;
  durationMs?: number;
  icon?: ReactNode;
  onRetry?: () => void;
}

export interface ChatToolCallProps extends ChatToolCallItem {
  defaultOpen?: boolean;
  className?: string;
}

const STATUS_LABEL: Record<ChatToolStatus, string> = {
  running: "调用中",
  done: "已完成",
  error: "失败",
};

export function formatToolDuration(ms: number) {
  if (ms < 1000) return `${Math.max(0.1, Math.round(ms / 100) / 10)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function KeyValues({
  data,
}: {
  data: Record<string, string | number> | string;
}) {
  if (typeof data === "string") {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-foreground">
        {data}
      </pre>
    );
  }
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs leading-5">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="min-w-0 truncate font-mono text-foreground">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * ChatToolCall — one tool invocation in a turn. Mapped from affectUI
 * tool-call-card / Arc tool-call onto scaffold tokens: 4px corners, business
 * wording, no injected CSS or bouncing spinner.
 */
export function ChatToolCall({
  title,
  name,
  status,
  input,
  output,
  error,
  durationMs,
  icon,
  onRetry,
  defaultOpen = false,
  className,
}: ChatToolCallProps) {
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen || status === "error");
  const hasBody = input != null || output != null || Boolean(error) || Boolean(name);

  return (
    <div
      data-slot="chat-tool-call"
      data-status={status}
      className={cn("min-w-0 overflow-hidden rounded-[4px] border border-border bg-card", className)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={hasBody ? bodyId : undefined}
        className="flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left"
        onClick={() => hasBody && setOpen((current) => !current)}
        disabled={!hasBody}
      >
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full [&>svg]:size-3.5",
            status === "error"
              ? "bg-[color:var(--state-error-bg)] text-[color:var(--state-error-fg)]"
              : status === "running"
                ? "bg-[color:var(--kpi-emphasis-icon)] text-brand"
                : "bg-muted text-muted-foreground",
          )}
        >
          {status === "running" ? (
            <ChatSpark status="thinking" size={14} announce={false} />
          ) : (
            (icon ?? <Wrench aria-hidden />)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium leading-5 text-foreground">{title}</span>
          {status === "running" ? (
            <span className="sr-only">{STATUS_LABEL[status]}</span>
          ) : null}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums leading-5",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status === "error"
            ? STATUS_LABEL.error
            : status === "running"
              ? STATUS_LABEL.running
              : durationMs != null
                ? formatToolDuration(durationMs)
                : STATUS_LABEL.done}
        </span>
        {hasBody ? (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
              open && "rotate-90",
            )}
            aria-hidden
          />
        ) : null}
      </button>
      {open && hasBody ? (
        <div id={bodyId} className="space-y-2 border-t border-border px-2.5 py-2">
          {name ? <p className="font-mono text-[11px] leading-4 text-muted-foreground">{name}</p> : null}
          {status === "error" ? (
            <div className="flex flex-wrap items-start gap-2">
              <p className="min-w-0 flex-1 text-xs leading-5 text-destructive">{error ?? "工具调用失败"}</p>
              {onRetry ? (
                <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={onRetry}>
                  重试
                </Button>
              ) : null}
            </div>
          ) : null}
          {input != null ? (
            <section>
              <p className="mb-1 text-[11px] leading-4 text-muted-foreground">参数</p>
              <KeyValues data={input} />
            </section>
          ) : null}
          {output != null ? (
            <section>
              <p className="mb-1 text-[11px] leading-4 text-muted-foreground">结果</p>
              <KeyValues data={output} />
            </section>
          ) : status === "running" ? (
            <p className="text-xs leading-5 text-muted-foreground">等待返回…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface ChatToolGroupProps {
  items: ChatToolCallItem[];
  /** Closed label when idle, e.g. "已调用 2 个工具". */
  label?: string;
  runningLabel?: string;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * ChatToolGroup — folds several calls so the answer is not buried.
 */
export function ChatToolGroup({
  items,
  label,
  runningLabel = "正在调用工具",
  defaultOpen,
  className,
}: ChatToolGroupProps) {
  const listId = useId();
  const running = items.some((item) => item.status === "running");
  const failed = items.filter((item) => item.status === "error").length;
  const [open, setOpen] = useState(defaultOpen ?? running);
  const [touched, setTouched] = useState(false);
  const doneLabel = label ?? `已调用 ${items.length} 个工具`;
  const title = running ? runningLabel : doneLabel;

  useEffect(() => {
    if (touched || defaultOpen != null) return;
    setOpen(running);
  }, [running, touched, defaultOpen]);

  if (!items.length) return null;

  return (
    <div data-slot="chat-tool-group" className={cn("min-w-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        className="inline-flex max-w-full items-center gap-1 rounded-[4px] py-0.5 text-left text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        onClick={() => {
          setTouched(true);
          setOpen((current) => !current);
        }}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span className="min-w-0 truncate">
          {title}
          {!running && failed > 0 ? ` · ${failed} 项失败` : null}
        </span>
      </button>
      {open ? (
        <div id={listId} className="mt-1.5 flex flex-col gap-1.5">
          {items.map((item) => (
            <ChatToolCall key={item.id} {...item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
