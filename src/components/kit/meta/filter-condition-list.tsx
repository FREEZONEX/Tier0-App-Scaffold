"use client";

/**
 * FilterConditionList — 视图「数据过滤」: rows of
 * 字段 + 运算符 + 值 + ×, 「＋ 添加筛选条件」. Date fields offer the nine
 * operators incl. 动态筛选 (今天 … 自定义(范围) 过去 N 日 ~ 当前 M 日). With
 * `lockFirst` the first row (创建时间) keeps its field and cannot be removed.
 */
import { CalendarDays, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { RequiredMark } from "@/components/forms/field-label";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { controlFrameClass } from "@/components/kit/ui/control-styles";
import { DatePicker, DateRangePicker } from "@/components/kit/ui/date-picker";
import { Input } from "@/components/kit/ui/input";
import {
  NumberInput,
  NumberRangeInput,
} from "@/components/kit/ui/number-input";
import { Popover } from "@/components/kit/ui/popover";
import { Select } from "@/components/kit/ui/select";
import {
  DYNAMIC_DATE_PRESETS,
  DYNAMIC_UNITS,
  isHiddenFilterCandidate,
  isPersonField,
  operatorLabel,
  operatorOptionsFor,
  operatorTakesValue,
} from "@/lib/component-kit/query-model";
import type {
  DynamicDateValue,
  FieldDef,
  FilterOperator,
  QueryFilter,
  RefValue,
} from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { PersonInput, ReferenceInput } from "@/components/kit/meta/reference-input";

interface FilterRow extends QueryFilter {
  key: string;
}

type Primitive = string | number;

function operatorsOf(field: FieldDef | undefined): FilterOperator[] {
  if (!field) return [];
  if (field.operators?.length) return field.operators;
  return operatorOptionsFor(field).map((option) => option.value);
}

function defaultValueFor(operator: FilterOperator): unknown {
  if (operator === "DYNAMIC")
    return { preset: "TODAY" } satisfies DynamicDateValue;
  return undefined;
}

type DynamicUnit = NonNullable<DynamicDateValue["pastUnit"]>;

/**
 * One bound of 自定义(范围) as the compact box「过去 365 日 📅」: clicking it opens a small
 * panel with the amount and the unit (日 / 周 / 月).
 */
function DynamicBoundChip({
  prefix,
  amount,
  unit,
  min,
  onChange,
}: {
  prefix: string;
  amount: number;
  unit: DynamicUnit;
  min: number;
  onChange: (amount: number, unit: DynamicUnit) => void;
}) {
  const [open, setOpen] = useState(false);
  const unitLabel = DYNAMIC_UNITS.find((item) => item.value === unit)?.label ?? "日";
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      aria-label={`${prefix}时间`}
      className="p-3"
      content={
        <div className="flex items-center gap-2 text-sm whitespace-nowrap text-text-secondary">
          <span className="shrink-0">{prefix}</span>
          <NumberInput
            aria-label={`${prefix}数量`}
            className="w-20"
            min={min}
            precision={0}
            value={amount}
            onChange={(next) => onChange(next ?? min, unit)}
          />
          <Select<string>
            aria-label={`${prefix}单位`}
            className="w-20"
            value={unit}
            options={DYNAMIC_UNITS.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(next) => onChange(amount, (next ?? "DAY") as DynamicUnit)}
          />
        </div>
      }
    >
      <button
        type="button"
        aria-label={`${prefix} ${amount} ${unitLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(controlFrameClass({ active: open }), "w-fit shrink-0 cursor-pointer gap-2 px-3 whitespace-nowrap")}
      >
        <span className="tabular-nums">
          {prefix} {amount} {unitLabel}
        </span>
        <CalendarDays className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
      </button>
    </Popover>
  );
}

function DynamicDateEditor({
  value,
  onChange,
}: {
  value: DynamicDateValue | undefined;
  onChange: (value: DynamicDateValue) => void;
}) {
  const current: DynamicDateValue = value ?? { preset: "TODAY" };
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Select<string>
        aria-label="动态筛选"
        value={current.preset}
        options={DYNAMIC_DATE_PRESETS.map((preset) => ({
          value: preset.value,
          label: preset.label,
        }))}
        onChange={(preset) => {
          if (!preset) return;
          if (preset === "CUSTOM_RANGE") {
            onChange({
              preset,
              pastAmount: 365,
              pastUnit: "DAY",
              currentAmount: 1,
              currentUnit: "DAY",
            });
          } else {
            onChange({ preset: preset as DynamicDateValue["preset"] });
          }
        }}
      />
      {current.preset === "CUSTOM" ? (
        <DatePicker
          aria-label="日期"
          value={current.date ?? null}
          onChange={(date) => onChange({ ...current, date: date ?? undefined })}
        />
      ) : null}
      {current.preset === "CUSTOM_RANGE" ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-text-secondary">
          <DynamicBoundChip
            prefix="过去"
            amount={current.pastAmount ?? 0}
            unit={current.pastUnit ?? "DAY"}
            min={0}
            onChange={(amount, unit) => onChange({ ...current, pastAmount: amount, pastUnit: unit })}
          />
          <span className="shrink-0 text-text-tertiary" aria-hidden="true">
            -
          </span>
          <DynamicBoundChip
            prefix="当前"
            amount={current.currentAmount ?? 1}
            unit={current.currentUnit ?? "DAY"}
            min={1}
            onChange={(amount, unit) => onChange({ ...current, currentAmount: amount, currentUnit: unit })}
          />
        </div>
      ) : null}
    </div>
  );
}

export interface FilterValueEditorProps {
  field: FieldDef;
  operator: FilterOperator;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Value control of one filter row, chosen by field type and operator. */
export function FilterValueEditor({
  field,
  operator,
  value,
  onChange,
}: FilterValueEditorProps) {
  if (!operatorTakesValue(operator))
    return <span className="text-sm text-text-tertiary">无需填写值</span>;
  const multi = operator === "IN" || operator === "NOT_IN";
  switch (field.type) {
    case "DATETIME":
      if (operator === "DYNAMIC") {
        return (
          <DynamicDateEditor
            value={value as DynamicDateValue | undefined}
            onChange={onChange}
          />
        );
      }
      if (operator === "BETWEEN") {
        const range = Array.isArray(value)
          ? (value as [string | null, string | null])
          : null;
        return (
          <DateRangePicker
            aria-label={field.name}
            precision="DATE"
            valueFormat="date"
            value={range}
            onChange={(next) => onChange(next ?? undefined)}
          />
        );
      }
      return (
        <DatePicker
          aria-label={field.name}
          value={typeof value === "string" ? value : null}
          onChange={(next) => onChange(next ?? undefined)}
        />
      );
    case "NUMBER":
      if (operator === "BETWEEN") {
        return (
          <NumberRangeInput
            aria-label={field.name}
            value={
              Array.isArray(value)
                ? (value as [number | null, number | null])
                : null
            }
            onChange={(next) => onChange(next ?? undefined)}
          />
        );
      }
      return (
        <NumberInput
          aria-label={field.name}
          value={typeof value === "number" ? value : null}
          onChange={(next) => onChange(next ?? undefined)}
        />
      );
    case "SINGLE_SELECT":
    case "MULTI_SELECT": {
      const options = (field.options ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        color: option.color ?? undefined,
      }));
      if (multi || field.type === "MULTI_SELECT") {
        return (
          <Select<Primitive>
            aria-label={field.name}
            multiple
            options={options}
            value={
              Array.isArray(value)
                ? (value as Primitive[])
                : value === undefined || value === null
                  ? []
                  : [value as Primitive]
            }
            onChange={(next) => onChange(next)}
          />
        );
      }
      return (
        <Select<Primitive>
          aria-label={field.name}
          allowClear
          options={options}
          value={(value as Primitive | undefined) ?? null}
          onChange={(next) => onChange(next ?? undefined)}
        />
      );
    }
    case "RELATION_OBJECT": {
      const refs = (
        Array.isArray(value) ? value : value ? [value] : []
      ) as RefValue[];
      if (isPersonField(field)) {
        return (
          <PersonInput
            aria-label={field.name}
            multiple
            value={refs}
            onChange={(next) => onChange(next ?? [])}
          />
        );
      }
      return (
        <ReferenceInput
          aria-label={field.name}
          field={field}
          multiple
          value={refs}
          onChange={(next) => onChange(next ?? [])}
        />
      );
    }
    default:
      return (
        <Input
          aria-label={field.name}
          allowClear
          value={
            typeof value === "string" || typeof value === "number"
              ? String(value)
              : ""
          }
          placeholder="请输入"
          onChange={(next) => onChange(next)}
        />
      );
  }
}

export interface FilterConditionListProps {
  fields: readonly FieldDef[];
  value: readonly QueryFilter[];
  onChange: (filters: QueryFilter[]) => void;
  /** Keep the first row's field (创建时间) fixed and required. */
  lockFirst?: boolean;
  className?: string;
}

export function FilterConditionList({
  fields,
  value,
  onChange,
  lockFirst = false,
  className,
}: FilterConditionListProps) {
  const [rows, setRows] = useState<FilterRow[]>(() =>
    value.map((filter, index) => ({ ...filter, key: `initial-${index}` })),
  );
  const seedRef = useRef(0);
  const byCode = new Map(fields.map((field) => [field.code, field]));

  const commit = (next: FilterRow[]) => {
    setRows(next);
    onChange(
      next
        .filter((row) => row.field)
        .map(({ field, operator, value: filterValue }) => ({
          field,
          operator,
          value: filterValue,
        })),
    );
  };

  const update = (key: string, patch: Partial<QueryFilter>) => {
    commit(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {rows.map((row, index) => {
        const field = byCode.get(row.field);
        const locked = lockFirst && index === 0;
        const operators = operatorsOf(field);
        return (
          <div
            key={row.key}
            className="flex min-w-0 flex-col gap-2 rounded-md bg-[#f7f8fa] p-2 sm:flex-row sm:items-start"
          >
            <div className="flex min-w-0 items-center gap-1 sm:w-40 sm:shrink-0">
              {locked ? <RequiredMark /> : null}
              <Select<string>
                aria-label="筛选字段"
                className="min-w-0 flex-1"
                showSearch
                disabled={locked}
                placeholder="请选择字段"
                value={row.field || null}
                options={fields
                  .filter((item) => item.code === row.field || !isHiddenFilterCandidate(item))
                  .map((item) => ({
                    value: item.code,
                    label: item.name,
                  }))}
                onChange={(code) => {
                  const nextField = code ? byCode.get(code) : undefined;
                  const operator = operatorsOf(nextField)[0] ?? "EQ";
                  update(row.key, {
                    field: code ?? "",
                    operator,
                    value: defaultValueFor(operator),
                  });
                }}
              />
            </div>
            <Select<string>
              aria-label="运算符"
              className="sm:w-32 sm:shrink-0"
              disabled={!field}
              value={row.operator}
              options={operators.map((operator) => ({
                value: operator,
                label: operatorLabel(operator),
              }))}
              onChange={(operator) => {
                if (!operator) return;
                update(row.key, {
                  operator: operator as FilterOperator,
                  value: defaultValueFor(operator as FilterOperator),
                });
              }}
            />
            <div className="min-w-0 flex-1">
              {field ? (
                <FilterValueEditor
                  field={field}
                  operator={row.operator}
                  value={row.value}
                  onChange={(next) => update(row.key, { value: next })}
                />
              ) : null}
            </div>
            <IconButton
              size="md"
              label="删除筛选条件"
              icon={<X />}
              disabled={locked}
              className="self-end sm:self-start"
              onClick={() =>
                commit(rows.filter((item) => item.key !== row.key))
              }
            />
          </div>
        );
      })}
      <div>
        <TextButton
          icon={<Plus />}
          onClick={() => {
            seedRef.current += 1;
            const key = `added-${seedRef.current}`;
            setRows((current) => [
              ...current,
              { key, field: "", operator: "EQ", value: undefined },
            ]);
          }}
        >
          添加筛选条件
        </TextButton>
      </div>
    </div>
  );
}
