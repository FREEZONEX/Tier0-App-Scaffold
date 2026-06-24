"use client";

import { Info } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { Tooltip } from "./Tooltip";

export interface AlarmLimits {
  hihi?: number;
  hi?: number;
  lo?: number;
  lolo?: number;
}

const numOrU = (s: string): number | undefined => {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

function NumField({ label, value, onChange, testid }: { label: string; value?: number; onChange: (v?: number) => void; testid?: string }) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className="w-8 shrink-0">{label}</span>
      <input
        type="number"
        defaultValue={value ?? ""}
        onBlur={(e) => onChange(numOrU(e.target.value))}
        className="w-14 rounded-sm border border-input bg-background px-1 py-0.5 font-mono text-[10px] text-foreground"
        data-testid={testid}
      />
    </label>
  );
}

/** Tooltip 里单条报警等级说明：等级码（带 alarm/warn 色点）+ 一句话含义。 */
function AlarmHint({ code, tone, text }: { code: string; tone: "alarm" | "warn"; text: string }) {
  const dot = tone === "alarm" ? "bg-state-error-fg" : "bg-state-paused-fg";
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-1 inline-flex shrink-0 items-center gap-1">
        <span className={`size-1.5 rounded-full ${dot}`} />
        <code className="font-mono font-semibold text-foreground">{code}</code>
      </span>
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}

/**
 * 告警阈值编辑器（标题 + 等级说明 tooltip + HIHI/HI/LO/LOLO 四格）。
 * binding 数值字段与额外数据点（watch）共用，保证两处阈值交互完全一致。
 * 全部留空时回调 undefined（清除阈值配置）。
 */
export function AlarmLimitsEditor({
  alarms,
  onChange,
  testidPrefix = "alarm",
}: {
  alarms?: AlarmLimits;
  onChange: (a?: AlarmLimits) => void;
  /** data-testid 前缀：binding 用 "alarm"（兼容既有 E2E），watch 用 "watch-alarm"。 */
  testidPrefix?: string;
}) {
  const t = useT();
  const set = (k: keyof AlarmLimits, v?: number) => {
    const next: AlarmLimits = { ...alarms, [k]: v };
    for (const key of Object.keys(next) as (keyof AlarmLimits)[]) if (next[key] === undefined) delete next[key];
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };
  return (
    <>
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <span>{t("阈值 alarms（越限派生 warn/alarm）")}</span>
        <Tooltip
          side="bottom"
          align="right"
          content={
            <div className="space-y-1">
              <div className="font-semibold text-foreground">{t("报警等级（自上而下越来越严重）")}</div>
              <AlarmHint code="HIHI" tone="alarm" text={t("高高报：值 ≥ 此限，触发严重报警（红）")} />
              <AlarmHint code="HI" tone="warn" text={t("高报：值 ≥ 此限，触发警告（黄）")} />
              <AlarmHint code="LO" tone="warn" text={t("低报：值 ≤ 此限，触发警告（黄）")} />
              <AlarmHint code="LOLO" tone="alarm" text={t("低低报：值 ≤ 此限，触发严重报警（红）")} />
              <div className="pt-0.5 text-muted-foreground">{t("留空=不启用该级；按原始值判定。")}</div>
            </div>
          }
        >
          <button type="button" aria-label={t("报警等级说明")} className="text-muted-foreground hover:text-foreground">
            <Info className="size-3" />
          </button>
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {/* key 含外部值：undo/redo 等外部变更时强制重挂，defaultValue 才能取到新值（非受控 input 的刷新口） */}
        <NumField key={`hihi-${alarms?.hihi ?? ""}`} label="HIHI" value={alarms?.hihi} onChange={(v) => set("hihi", v)} testid={`${testidPrefix}-hihi`} />
        <NumField key={`hi-${alarms?.hi ?? ""}`} label="HI" value={alarms?.hi} onChange={(v) => set("hi", v)} testid={`${testidPrefix}-hi`} />
        <NumField key={`lo-${alarms?.lo ?? ""}`} label="LO" value={alarms?.lo} onChange={(v) => set("lo", v)} testid={`${testidPrefix}-lo`} />
        <NumField key={`lolo-${alarms?.lolo ?? ""}`} label="LOLO" value={alarms?.lolo} onChange={(v) => set("lolo", v)} testid={`${testidPrefix}-lolo`} />
      </div>
    </>
  );
}

export { NumField as AlarmNumField };
