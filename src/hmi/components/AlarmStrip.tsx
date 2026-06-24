"use client";

import { useState } from "react";
import { TriangleAlert, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import type { ActiveAlarm } from "@/hmi/scene/active-alarms";

/**
 * 全局告警汇总（status-by-exception）：常态一颗低调绿「正常」胶囊；有越限时变红/琥珀
 * 计数胶囊（N 报警 · M 预警），点开看全表，点某条选中并居中那台设备。
 * 节点级环/角标负责「这台」，本栏负责「全场哪些」——操作员不必满图扫。
 */
export function AlarmStrip({ alarms, onSelect }: { alarms: readonly ActiveAlarm[]; onSelect: (nodeId: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const alarmCount = alarms.filter((a) => a.level === "alarm").length;
  const warnCount = alarms.length - alarmCount;
  const has = alarms.length > 0;
  const worstAlarm = alarmCount > 0;

  const pill = has
    ? worstAlarm
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : "border-state-paused-border bg-state-paused-bg text-state-paused-fg"
    : "border-border bg-card text-muted-foreground";

  return (
    <div className="flex flex-col items-end gap-1" data-testid="alarm-strip" data-alarm-count={alarmCount} data-warn-count={warnCount}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!has}
        aria-label={t("告警汇总")}
        data-testid="alarm-strip-toggle"
        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium shadow-sm ${pill} ${has ? "hover:brightness-95" : "cursor-default"} ${worstAlarm ? "motion-safe:animate-pulse" : ""}`}
      >
        {has ? <TriangleAlert className="size-3.5" /> : <Check className="size-3.5" />}
        {has ? (
          <span>
            {alarmCount > 0 ? t("{n} 报警", { n: alarmCount }) : null}
            {alarmCount > 0 && warnCount > 0 ? " · " : null}
            {warnCount > 0 ? t("{n} 预警", { n: warnCount }) : null}
          </span>
        ) : (
          <span>{t("无报警")}</span>
        )}
        {has ? (open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />) : null}
      </button>

      {open && has ? (
        <ul className="max-h-[40vh] w-60 overflow-auto rounded-sm border border-border bg-card py-1 shadow-md" data-testid="alarm-strip-list">
          {alarms.map((a, i) => (
            <li key={`${a.nodeId}-${a.field}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(a.nodeId)}
                title={`${a.label} · ${a.field}`}
                className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] hover:bg-surface-inset"
              >
                <span className={`size-1.5 shrink-0 rounded-full ${a.level === "alarm" ? "bg-destructive" : "bg-state-paused-fg"}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">{a.label}</span>
                <span className="shrink-0 text-muted-foreground">{a.field}</span>
                {a.value !== undefined ? <span className="shrink-0 font-mono text-foreground">{a.value}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
