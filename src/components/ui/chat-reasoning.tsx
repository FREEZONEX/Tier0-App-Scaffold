"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ThinkingLoader } from "@/components/ui/thinking-loader";
import { formatToolDuration } from "@/components/ui/chat-tool-call";
import { cn } from "@/lib/utils";

export interface ChatReasoningStep {
  id: string;
  label: ReactNode;
}

export interface ChatReasoningProps {
  /** What was checked — business wording, not "thinking…". */
  title?: ReactNode;
  defaultOpen?: boolean;
  children?: ReactNode;
  /** Live analysis vs folded result. */
  status?: "thinking" | "done";
  durationMs?: number;
  steps?: ChatReasoningStep[];
  className?: string;
}

/**
 * ChatReasoning — folded working under a reply. A text toggle, not a form section.
 * While `status="thinking"`, steps stay open under ThinkingLoader.
 */
export function ChatReasoning({
  title,
  defaultOpen = false,
  children,
  status = "done",
  durationMs,
  steps,
  className,
}: ChatReasoningProps) {
  const thinking = status === "thinking";
  const [open, setOpen] = useState(defaultOpen || thinking);
  const heading =
    title ??
    (thinking
      ? "正在核对工艺"
      : durationMs != null
        ? `已核对工艺文件 · ${formatToolDuration(durationMs)}`
        : "已核对工艺文件");
  const body = (
    <>
      {steps && steps.length > 0 ? (
        <ol className="list-decimal space-y-1 pl-4">
          {steps.map((step) => (
            <li key={step.id}>{step.label}</li>
          ))}
        </ol>
      ) : null}
      {children}
    </>
  );

  if (thinking) {
    return (
      <div data-slot="chat-reasoning" data-status="thinking" className={cn("min-w-0 space-y-1.5", className)}>
        <ThinkingLoader variant="plain" size="sm" phases={["正在核对工艺", "对照文件", "整理要点"]} />
        {body ? <div className="pl-1 text-xs leading-5 text-muted-foreground">{body}</div> : null}
      </div>
    );
  }

  return (
    <div data-slot="chat-reasoning" data-status="done" className={cn("min-w-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-1 rounded-[4px] py-0.5 text-left text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span className="min-w-0 truncate">{heading}</span>
      </button>
      {open ? <div className="mt-1 pl-4 text-xs leading-5 text-muted-foreground">{body}</div> : null}
    </div>
  );
}
