"use client";

import { useT } from "@/hmi/i18n/context";
import { AlarmLimitsEditor, AlarmNumField } from "./AlarmLimitsEditor";
import type { Binding } from "@/hmi/schema/schema";

export interface Transform {
  map?: Record<string, boolean | number | string>;
  /** 判为真(开/运行)的条件。 */
  test?: { op: "eq" | "ne" | "gt" | "lt" | "ge" | "le"; value: string };
  /** 判为假(关/停止)的条件，与 test 各自独立。 */
  testOff?: { op: "eq" | "ne" | "gt" | "lt" | "ge" | "le"; value: string };
  invert?: boolean;
  scale?: { min: number; max: number };
  alarms?: { hihi?: number; hi?: number; lo?: number; lolo?: number };
  /** 显示单位（用户填，不内置推断）。仅显示用。 */
  unit?: string;
}

/** 数值字段映射：量程 scale（仅驱动视觉比例）+ 单位 + 告警阈值（判原始值，编辑器与 watch 共用）。 */
export function BindingMapEditor({
  kind: _kind,
  binding,
  onChange,
}: {
  kind: "number";
  binding?: Binding;
  onChange: (t: Transform) => void;
}) {
  const tr8 = useT();
  const base: Transform = { map: binding?.map, invert: binding?.invert, scale: binding?.scale, alarms: binding?.alarms, unit: binding?.unit };
  const setScale = (k: "min" | "max", v?: number) => {
    const next = { ...(base.scale ?? { min: 0, max: 100 }), [k]: v ?? (k === "min" ? 0 : 100) };
    onChange({ ...base, scale: next });
  };
  const setUnit = (v: string) => {
    const u = v.trim();
    onChange({ ...base, unit: u === "" ? undefined : u });
  };
  return (
    <div className="space-y-1 rounded-sm bg-surface-inset/50 p-1.5">
      <div className="text-[10px] font-medium text-muted-foreground">{tr8("量程 scale（min/max 决定填充比例/仪表角度；显示仍是真实值）")}</div>
      <div className="flex flex-wrap items-center gap-3">
        <AlarmNumField key={`min-${base.scale?.min ?? ""}`} label="min" value={base.scale?.min} onChange={(v) => setScale("min", v)} />
        <AlarmNumField key={`max-${base.scale?.max ?? ""}`} label="max" value={base.scale?.max} onChange={(v) => setScale("max", v)} />
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="shrink-0">{tr8("单位")}</span>
          <input
            key={`unit-${base.unit ?? ""}`}
            type="text"
            defaultValue={base.unit ?? ""}
            onBlur={(e) => setUnit(e.target.value)}
            placeholder={tr8("如 L / ℃ / %")}
            className="w-16 rounded-sm border border-input bg-background px-1 py-0.5 font-mono text-[10px] text-foreground"
            data-testid="binding-unit"
          />
        </label>
      </div>
      <AlarmLimitsEditor alarms={base.alarms} onChange={(a) => onChange({ ...base, alarms: a })} />
    </div>
  );
}
