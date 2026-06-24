"use client";

import { useState } from "react";
import { SymbolCanvas } from "./SymbolCanvas";
import { buildSwatch } from "./legend-entries";
import { useT } from "@/hmi/i18n/context";
import { makeState, PREVIEW_PROPS } from "@/hmi/symbols/preview";
import type { Capability } from "@/hmi/symbols/capabilities";
import type { Registry } from "@/hmi/symbols/registry";
import type { Palette } from "@/hmi/engine/theme";
import type { Binding } from "@/hmi/schema/schema";
import type { Transform } from "./BindingMapEditor";

const LABELS: Record<string, readonly [string, string]> = {
  open: ["开", "关"], closed: ["闭合", "断开"], running: ["运行", "停止"], on: ["通", "断"],
};

type Op = "eq" | "ne" | "gt" | "lt" | "ge" | "le";
const OPS: readonly { v: Op; label: string }[] = [
  { v: "eq", label: "=" }, { v: "ne", label: "≠" },
  { v: "gt", label: ">" }, { v: "lt", label: "<" },
  { v: "ge", label: "≥" }, { v: "le", label: "≤" },
];

const isTrue = (v: boolean | number | string) => v === true || v === 1 || v === "true";

/** 上状态(开/运行)条件：优先 test；兼容历史 map（从真值 keys 推等值条件）。 */
function initOn(binding?: Binding): { op: Op; value: string } {
  if (binding?.test) return binding.test;
  if (binding?.map) {
    const trues = Object.entries(binding.map).filter(([, v]) => isTrue(v)).map(([k]) => k);
    if (trues.length) return { op: "eq", value: trues.join(", ") };
  }
  return { op: "eq", value: "" };
}

/** 下状态(关/停止)条件：仅 testOff，默认空（留空=其余取补）。 */
function initOff(binding?: Binding): { op: Op; value: string } {
  return binding?.testOff ?? { op: "eq", value: "" };
}

/**
 * 对着状态图各自配开/关：左边两个状态的真实图标，右边各填「设备值满足什么条件算这个状态」。
 * 两行各自独立（互不锁定）：命中开→开，命中关→关；只配其一→其余取补；两者都配且都不命中→未知。
 * 条件 = 运算符(= ≠ > < ≥ ≤) + 值，留空=默认按真假/取补。例：开 当 > 5；关 当 = 0,STOP。
 */
export function StateValueMap({
  capability,
  field,
  registry,
  palette,
  binding,
  onChange,
}: {
  capability: Capability;
  field: string;
  registry: Registry;
  palette: Palette;
  binding?: Binding;
  onChange: (patch: Pick<Transform, "test" | "testOff" | "map">) => void;
}) {
  const t = useT();
  const [onLabelZh, offLabelZh] = LABELS[field] ?? ["真", "假"];
  const onLabel = t(onLabelZh);
  const offLabel = t(offLabelZh);
  const on = initOn(binding);
  const off = initOff(binding);
  const [onOp, setOnOp] = useState<Op>(on.op);
  const [onVal, setOnVal] = useState(on.value);
  const [offOp, setOffOp] = useState<Op>(off.op);
  const [offVal, setOffVal] = useState(off.value);

  // 两条件各自独立落库（清掉旧的等值 map，test/testOff 优先）。留空的一行不产生条件。
  const emit = (a: Op, av: string, b: Op, bv: string) => {
    onChange({
      test: av.trim() ? { op: a, value: av.trim() } : undefined,
      testOff: bv.trim() ? { op: b, value: bv.trim() } : undefined,
      map: undefined,
    });
  };

  // 传类型代表性 props（如 vessel 的 agitator）：否则 prop 门控的状态视觉（立式容器「运行」=搅拌电机箱深填充）
  // 在预览里不画，运行/停止两态会长得一模一样。与调色板卡片 / 图例预览口径一致（都用 PREVIEW_PROPS）。
  const swatch = (state: boolean) => buildSwatch({ type: capability.type, state: makeState(capability, { [field]: state }), props: PREVIEW_PROPS[capability.type] }, palette, registry);
  const selCls = "shrink-0 rounded-sm border border-input bg-background px-1 py-0.5 text-[11px] text-foreground";
  const inputCls = "min-w-0 flex-1 rounded-sm border border-input bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground";

  // 一行 = 图标 + 状态名 + 当 + 算子下拉 + 值输入。内联（不抽子组件，避免重挂载导致输入框失焦）。
  const row = (isOn: boolean) => {
    const op = isOn ? onOp : offOp;
    const value = isOn ? onVal : offVal;
    const setOp = isOn ? setOnOp : setOffOp;
    const setVal = isOn ? setOnVal : setOffVal;
    const onOpChange = (o: Op) => {
      setOp(o);
      if (isOn) emit(o, value, offOp, offVal);
      else emit(onOp, onVal, o, value);
    };
    const onBlur = () => emit(onOp, onVal, offOp, offVal);
    return (
      <div className="flex items-start gap-2">
        <SymbolCanvas swatch={swatch(isOn)} theme={palette} className="size-9 shrink-0 rounded-sm border border-border" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-medium leading-tight text-foreground">{isOn ? onLabel : offLabel}</span>
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-[10px] text-muted-foreground">{t("当")}</span>
            <select
              value={op}
              onChange={(e) => onOpChange(e.target.value as Op)}
              className={selCls}
              aria-label={`${field} ${isOn ? t("开") : t("关")}`}
              data-testid={`${isOn ? "op" : "off-op"}-${field}`}
            >
              {OPS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <input
              value={value}
              onChange={(e) => setVal(e.target.value)}
              onBlur={onBlur}
              placeholder={isOn ? t("设备值（默认按真假）") : t("设备值（留空=其余）")}
              className={inputCls}
              data-testid={`${isOn ? "test" : "off"}-${field}`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2" data-testid="state-value-map">
      {row(true)}
      {row(false)}
    </div>
  );
}
