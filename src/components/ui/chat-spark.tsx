import { cn } from "@/lib/utils";

const RAYS = Array.from({ length: 8 }, (_, index) => index);

export type ChatSparkStatus = "idle" | "thinking" | "writing" | "done";

const STATUS_LABEL: Record<ChatSparkStatus, string> = {
  idle: "助手待命",
  thinking: "助手正在检索",
  writing: "助手正在生成",
  done: "助手已完成",
};

export interface ChatSparkProps {
  /** Map stream lifecycle: wait → thinking, tokens → writing, settled → idle/done. */
  status?: ChatSparkStatus;
  size?: number;
  className?: string;
  /** Decorative copies (avatars, empty marks) should not announce. */
  announce?: boolean;
}

/**
 * ChatSpark — Arc ai-spark mapped to scaffold tokens: eight tapered rays
 * around a core. Idle breathes, thinking ripples, writing pulses.
 * No bouncing dots, no highlight lime.
 */
export function ChatSpark({
  status = "idle",
  size = 16,
  className,
  announce = true,
}: ChatSparkProps) {
  return (
    <span
      data-slot="chat-spark"
      data-status={status}
      role={announce ? "status" : undefined}
      aria-label={announce ? STATUS_LABEL[status] : undefined}
      aria-hidden={announce ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center text-foreground", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 16 16" className="size-full overflow-visible text-foreground" aria-hidden>
        {RAYS.map((index) => (
          <line
            key={index}
            x1="8"
            y1="1.5"
            x2="8"
            y2={index % 2 === 0 ? 5 : 4.1}
            transform={`rotate(${index * 45} 8 8)`}
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinecap="round"
            style={{ animationDelay: `${index * 90}ms` }}
          />
        ))}
        <circle cx="8" cy="8" r="1.05" fill="currentColor" />
      </svg>
    </span>
  );
}
