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
//
// Negated forms are trapped BEFORE the positive tier they contain, otherwise
// substring matching paints them green: "abnormal" contains "normal",
// "inactive" contains "active", "不正常" contains "正常". The idle tier also
// runs before running for the same reason. Never let a negative read as OK.
const TONE_KEYWORDS: ReadonlyArray<readonly [StatusTone, readonly string[]]> = [
  ["error", ["abnormal", "error", "expired", "expir", "fail", "block", "frozen", "freeze", "reject", "cancel", "fault", "critical", "overdue", "scrap", "danger", "不正常", "非正常", "不合格", "不通过", "未通过", "报废", "冻结", "过期", "失效", "失败", "拒绝", "异常", "故障", "超期", "危"]],
  ["paused", ["not_", "not ", "cannot", "unavail", "pending", "partial", "warn", "near", "hold", "pause", "quarantine", "waiting", "review", "expiring", "low", "不可用", "未完成", "预警", "临期", "部分", "待", "暂停", "隔离", "挂起", "低", "审"]],
  ["idle", ["idle", "inactive", "disabled", "closed", "archived", "unknown", "停用", "禁用", "关闭", "归档", "未知"]],
  ["running", ["normal", "active", "running", "progress", "done", "complete", "finish", "release", "approve", "available", "in_stock", "instock", "enabled", "online", "pass", "ready", "ok", "success", "正常", "启用", "完成", "通过", "在库", "可用", "运行", "成功", "上线"]],
  ["info", ["info", "queue", "submit", "schedule", "planned", "plan", "processing", "new", "draft", "信息", "排队", "提交", "计划", "处理中", "新建", "草稿"]],
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
  /** Leading tone dot (default on) for fast scanning in dense tables. */
  dot?: boolean;
  /** Ping the dot for live states such as a running line or an active alarm. */
  pulse?: boolean;
  children?: ReactNode;
}

export function StatusBadge({
  tone,
  status,
  dot = true,
  pulse = false,
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
        "inline-flex h-[22px] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-2 text-xs font-normal leading-5",
        toneClass[resolved],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden="true" className="relative flex size-1.5 shrink-0">
          {pulse ? (
            <span className="absolute inset-0 rounded-full bg-current opacity-60 animate-[ping-dot_1.6s_cubic-bezier(0,0,0.2,1)_infinite]" />
          ) : null}
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {label}
    </span>
  );
}
