"use client";

import { useEffect, useState } from "react";
import { ChatSpark } from "@/components/ui/chat-spark";
import { cn } from "@/lib/utils";

export interface ThinkingLoaderProps {
  /** Labels that walk while the model is working. */
  phases?: string[];
  /** Time per phase, in ms. */
  interval?: number;
  /** Single label instead of cycling (still shimmers). */
  label?: string;
  size?: "sm" | "md";
  /** pill = bordered capsule; plain = in-transcript. */
  variant?: "pill" | "plain";
  className?: string;
}

const DEFAULT_PHASES = ["正在检索", "对照工艺", "整理回答"];

/**
 * ThinkingLoader — affectUI thinking-loader, restyled to scaffold tokens.
 * Eight-ray spark plus a shimmering phase label. Prefer `plain` inside a turn.
 */
export function ThinkingLoader({
  phases = DEFAULT_PHASES,
  interval = 2200,
  label,
  size = "sm",
  variant = "plain",
  className,
}: ThinkingLoaderProps) {
  const list = label ? [label] : phases.length ? phases : DEFAULT_PHASES;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const id = window.setInterval(() => {
      setStep((current) => (current + 1) % list.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [list, interval]);

  const text = list[Math.min(step, list.length - 1)] ?? list[0];
  const sparkSize = size === "sm" ? 13 : 15;

  return (
    <span
      data-slot="thinking-loader"
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-2",
        size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
        variant === "pill" && "rounded-full border border-border bg-card px-2.5 shadow-xs",
        className,
      )}
    >
      <ChatSpark status="thinking" size={sparkSize} announce={false} />
      <span className="chat-shimmer min-w-0 truncate text-muted-foreground">{text}</span>
    </span>
  );
}
