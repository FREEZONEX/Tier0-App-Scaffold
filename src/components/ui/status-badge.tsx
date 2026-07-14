import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — the one shape for lifecycle/status labels. Colors come from
 * the scaffold state recipes (.state-*); the badge fixes size, radius and
 * weight so every app's statuses look consistent.
 *
 * `tone` is optional: omit it and the badge derives a sensible tone from the
 * status text (`status` prop or string children) via {@link statusTone}, so a
 * bare `<StatusBadge status={lot.status} />` still colors correctly instead of
 * defaulting every badge to one color. Pass `tone` to override.
 *
 * Tones map to the semantic state tokens:
 * - running: active/ok/in-progress (brand green family)
 * - idle:    neutral/draft/inactive
 * - paused:  warning/near-expiry/on-hold
 * - error:   failed/expired/blocked
 * - info:    informational/queued
 */
export type StatusTone = "running" | "idle" | "paused" | "error" | "info";

const toneClass: Record<StatusTone, string> = {
  running: "state-running",
  idle: "state-idle",
  paused: "state-paused",
  error: "state-error",
  info: "state-info",
};

// Ordered most-urgent first so a value that reads as several things (e.g.
// "expired-normal") lands on the tone that matters. Substring match keeps it
// tolerant of enum casing, separators, and Chinese labels; anything unmatched
// falls to the neutral idle tone rather than mis-coloring.
const TONE_KEYWORDS: ReadonlyArray<readonly [StatusTone, readonly string[]]> = [
  ["error", ["error", "expired", "expir", "fail", "block", "frozen", "freeze", "reject", "cancel", "fault", "critical", "overdue", "scrap", "danger", "报废", "冻结", "过期", "失效", "失败", "拒绝", "异常", "故障", "超期", "危"]],
  ["paused", ["pending", "partial", "warn", "near", "hold", "pause", "quarantine", "waiting", "review", "expiring", "low", "预警", "临期", "部分", "待", "暂停", "隔离", "挂起", "低", "审"]],
  ["running", ["normal", "active", "running", "progress", "done", "complete", "finish", "release", "approve", "available", "in_stock", "instock", "enabled", "online", "pass", "ready", "ok", "success", "正常", "启用", "完成", "通过", "在库", "可用", "运行", "成功", "上线"]],
  ["info", ["info", "queue", "submit", "schedule", "planned", "plan", "processing", "new", "draft", "信息", "排队", "提交", "计划", "处理中", "新建", "草稿"]],
  ["idle", ["idle", "inactive", "disabled", "closed", "archived", "unknown", "停用", "关闭", "归档", "未知"]],
];

/** Map a raw status value to a semantic tone. Unknown → "idle" (neutral). */
export function statusTone(value: unknown): StatusTone {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "idle";
  for (const [tone, keys] of TONE_KEYWORDS) {
    if (keys.some((k) => v.includes(k))) return tone;
  }
  return "idle";
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Explicit tone. Omit to derive from `status`/string children. */
  tone?: StatusTone;
  /** Raw status value; used for the label and to derive tone when unset. */
  status?: string;
  children?: ReactNode;
}

export function StatusBadge({
  tone,
  status,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const label = children ?? status;
  const source =
    status ?? (typeof children === "string" ? children : "");
  const resolved = tone ?? statusTone(source);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-4",
        toneClass[resolved],
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}
