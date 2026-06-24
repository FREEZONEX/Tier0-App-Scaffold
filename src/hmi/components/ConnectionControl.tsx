"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/hmi/i18n/context";
import type { ConnectionStatus } from "@/hmi/data/data-source";
import type { DataSourceKind } from "@/hmi/data/source-factory";

const LABEL: Record<ConnectionStatus, string> = {
  disconnected: "未连接",
  connecting: "连接中",
  connected: "已连接",
  error: "连接错误",
};

// 连接成功 = 主题绿，失败/未连 = 红，连接中 = 琥珀脉冲。
// 注意用本项目已注册的 token（bg-success/bg-warning 未注册、类不生效 → 点会透明不可见）。
const DOT: Record<ConnectionStatus, string> = {
  disconnected: "bg-destructive",
  connecting: "bg-state-paused-fg motion-safe:animate-pulse",
  connected: "bg-state-running-fg",
  error: "bg-destructive",
};

/**
 * 数据源徽标（纯展示）：让用户始终知道画面被什么驱动，三态互斥——
 * - demo（演示模式·示例数据，蓝点）：空图回落示例图 + mock 数据，仅首屏演示
 * - mock（模拟数据，琥珀点）：真实图但未连真 broker，喂确定性仿真
 * - real（真实 MQTT，按连接状态绿/红/琥珀脉冲）：连真 broker
 * 状态文字 sr-only，详情进 title。
 */
export function ConnectionControl({
  status,
  brokerUrl,
  kind = "real",
}: {
  status: ConnectionStatus;
  brokerUrl: string;
  kind?: DataSourceKind;
}) {
  const t = useT();
  if (kind !== "real") {
    const isDemo = kind === "demo";
    const tag = isDemo ? t("演示") : t("模拟");
    const label = isDemo ? t("演示模式 · 示例数据") : t("模拟数据 · 未连接真实 broker");
    return (
      <span
        title={label}
        aria-label={label}
        data-testid="conn-status"
        data-status={kind}
        className="inline-flex items-center gap-1.5 rounded-sm bg-surface-inset px-1.5 py-0.5"
      >
        <span className={cn("size-2.5 rounded-full", isDemo ? "bg-focus-accent" : "bg-state-paused-fg")} aria-hidden />
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">{tag}</span>
        <span className="sr-only" role="status" aria-live="polite">{label}</span>
      </span>
    );
  }
  const label = t(LABEL[status]);
  return (
    <span
      title={brokerUrl ? `MQTT ${label} · ${brokerUrl}` : `MQTT ${label}`}
      aria-label={`MQTT ${label}`}
      data-testid="conn-status"
      data-status={status}
      className="inline-flex items-center gap-1.5 px-1"
    >
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">MQTT</span>
      <span className={cn("size-2.5 rounded-full", DOT[status])} aria-hidden />
      <span className="sr-only" role="status" aria-live="polite">{label}</span>
    </span>
  );
}
