"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * FieldControl — the editing control of one metadata field, by field type
 *: 文本(单行/多行+计数)、数字(小数位/千分位/范围/后缀)、时间(三种精度/区间)、
 * 单选(下拉/平铺，彩色选项，允许用户添加选项)、复选、关联对象(人员 / 弹窗参照 /
 * 下拉参照，单选/多选)、关联属性 / 关联引用(只读)、图片、附件、超链接.
 *
 * Shared by MetaForm, DetailTable cells, 批量修改 and 列头批量填充.
 */
import { Link2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckboxGroup } from "@/components/kit/ui/checkbox";
import type { ControlSize, ControlStatus, ControlVariant } from "@/components/kit/ui/control-styles";
import { DatePicker, DateRangePicker } from "@/components/kit/ui/date-picker";
import { Input, TextArea } from "@/components/kit/ui/input";
import { NumberInput } from "@/components/kit/ui/number-input";
import { RadioGroup } from "@/components/kit/ui/radio";
import { Select } from "@/components/kit/ui/select";
import { AttachmentUpload, ImageUpload } from "@/components/kit/ui/upload";
import { errorMessage } from "@/lib/component-kit/api-client";
import { displayPrecisionOf, fileList, formatFieldValue, isRefValue, toNumber } from "@/lib/component-kit/format";
import type { FormMode } from "@/lib/component-kit/form-model";
import { isPersonField } from "@/lib/component-kit/query-model";
import type { FieldDef, RefValue, SelectOption } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { PersonInput, ReferenceInput } from "@/components/kit/meta/reference-input";
import { ReferenceSelect } from "@/components/kit/meta/reference-select";

type Primitive = string | number;

export interface FieldControlProps {
  field: FieldDef;
  value: unknown;
  /** New value; relation pickers also pass the picked records (fillRules). */
  onChange: (value: unknown, records?: Record<string, unknown>[]) => void;
  /** Read-only (view mode, readonly widgets). */
  disabled?: boolean;
  mode?: FormMode;
  status?: ControlStatus;
  size?: ControlSize;
  variant?: ControlVariant;
  /** Table cell rendering: single-line text areas, small image tiles, no counters. */
  compact?: boolean;
  /** Needed for 「允许用户添加选项」 on custom select fields. */
  objectCode?: string;
  /** Options added by the user in this session. */
  extraOptions?: SelectOption[];
  onOptionAdded?: (option: SelectOption) => void;
  id?: string;
  className?: string;
}

function placeholderOf(field: FieldDef, verb: "输入" | "选择"): string {
  return field.widget?.placeholder || `请${verb}${field.name}`;
}

function AddOptionFooter({
  objectCode,
  field,
  onAdded,
  close,
}: {
  objectCode: string;
  field: FieldDef;
  onAdded: (option: SelectOption) => void;
  close: () => void;
}) {
  const api = useKitApi();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const add = async () => {
    const text = label.trim();
    if (!text) return;
    setSaving(true);
    try {
      const option = await api.sendJson<SelectOption>(apiUrl(`/api/meta/custom-field-options/${objectCode}/${field.code}`), {
        method: "POST",
        body: { label: text },
      });
      onAdded(option);
      setLabel("");
      toast.success(`已添加选项「${option.label}」`);
      close();
    } catch (error) {
      toast.error(errorMessage(error, "添加选项失败"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center gap-2 border-t border-border-secondary p-2" onMouseDown={(event) => event.stopPropagation()}>
      <Input
        size="sm"
        aria-label="新选项名称"
        placeholder="输入新选项"
        maxLength={50}
        value={label}
        onChange={(next) => setLabel(next)}
        onKeyDown={(event) => event.stopPropagation()}
        onPressEnter={() => void add()}
      />
      <Button size="sm" variant="primary" icon={<Plus />} loading={saving} disabled={!label.trim()} onClick={() => void add()}>
        添加
      </Button>
    </div>
  );
}

function toRefs(value: unknown): RefValue | RefValue[] | null {
  if (Array.isArray(value)) return value.filter(isRefValue);
  return isRefValue(value) ? value : null;
}

export function FieldControl({
  field,
  value,
  onChange,
  disabled = false,
  mode = "create",
  status,
  size = "md",
  variant = "outlined",
  compact = false,
  objectCode,
  extraOptions,
  onOptionAdded,
  id,
  className,
}: FieldControlProps) {
  const widget = field.widget ?? {};
  const label = field.name;

  switch (field.type) {
    case "TEXT": {
      const text = value === null || value === undefined ? "" : String(value);
      if (widget.multiline && !compact) {
        return (
          <TextArea
            id={id}
            aria-label={label}
            value={text}
            disabled={disabled}
            status={status}
            maxLength={widget.maxLength ?? 1000}
            rows={widget.rows ?? 3}
            placeholder={disabled ? undefined : placeholderOf(field, "输入")}
            className={className}
            onChange={(next) => onChange(next)}
          />
        );
      }
      return (
        <Input
          id={id}
          aria-label={label}
          size={size}
          variant={variant}
          value={text}
          disabled={disabled}
          status={status}
          allowClear={!disabled && !compact}
          maxLength={widget.maxLength ?? (widget.multiline ? 1000 : undefined)}
          suffix={widget.suffix}
          placeholder={disabled ? undefined : placeholderOf(field, "输入")}
          className={className}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case "NUMBER": {
      const decimalPlaces = widget.decimalPlaces;
      const amount = widget.thousandSeparator === true && (decimalPlaces ?? 0) <= 2;
      const min = typeof widget.minValue === "number" ? (widget.minValue > 0 && widget.minValue < 1 ? 0 : widget.minValue) : undefined;
      return (
        <NumberInput
          id={id}
          aria-label={label}
          size={size}
          variant={variant}
          value={toNumber(value)}
          disabled={disabled}
          status={status}
          precision={decimalPlaces}
          min={min}
          max={typeof widget.maxValue === "number" ? widget.maxValue : undefined}
          thousandSeparator={widget.thousandSeparator}
          fixedDecimals={amount}
          suffix={widget.suffix}
          align={compact ? "right" : "left"}
          placeholder={disabled ? undefined : placeholderOf(field, "输入")}
          className={className}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case "DATETIME": {
      const precision = displayPrecisionOf(widget, "DATETIME_SECOND");
      if (widget.isRange) {
        const range = Array.isArray(value) ? (value as [string | null, string | null]) : null;
        return (
          <DateRangePicker
            id={id}
            aria-label={label}
            size={size}
            variant={variant}
            precision={precision}
            value={range}
            disabled={disabled}
            status={status}
            className={className}
            onChange={(next) => onChange(next)}
          />
        );
      }
      return (
        <DatePicker
          id={id}
          aria-label={label}
          size={size}
          variant={variant}
          precision={precision}
          value={typeof value === "string" ? value : value instanceof Date ? value.toISOString() : null}
          disabled={disabled}
          status={status}
          placeholder={disabled ? undefined : placeholderOf(field, "选择")}
          className={className}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case "SINGLE_SELECT":
    case "MULTI_SELECT": {
      const merged = [...(field.options ?? []), ...(extraOptions ?? [])];
      const options = merged.map((option) => ({ value: option.value, label: option.label, color: option.color ?? undefined }));
      const canAdd = Boolean(widget.allowUserAddOption && objectCode && field.custom && onOptionAdded && !disabled);
      const footer = canAdd
        ? ({ close }: { close: () => void }) => (
            <AddOptionFooter objectCode={objectCode as string} field={field} onAdded={(option) => onOptionAdded?.(option)} close={close} />
          )
        : undefined;
      if (field.type === "SINGLE_SELECT") {
        if (widget.displayMode === "FLAT" && !compact) {
          return (
            <RadioGroup<Primitive>
              aria-label={label}
              options={options}
              value={(value as Primitive | null | undefined) ?? null}
              disabled={disabled}
              className={cn("min-h-8", className)}
              onChange={(next) => onChange(next)}
            />
          );
        }
        return (
          <Select<Primitive>
            id={id}
            aria-label={label}
            size={size}
            variant={variant}
            options={options}
            value={value === undefined || value === "" ? null : (value as Primitive | null)}
            allowClear={!widget.required}
            showSearch={widget.showSearch || options.length > 8}
            disabled={disabled}
            status={status}
            placeholder={disabled ? "" : placeholderOf(field, "选择")}
            popupFooter={footer}
            className={className}
            onChange={(next) => onChange(next)}
          />
        );
      }
      const list = Array.isArray(value) ? (value as Primitive[]) : value === null || value === undefined || value === "" ? [] : [value as Primitive];
      if (widget.displayMode === "FLAT" && !compact) {
        return (
          <CheckboxGroup<Primitive>
            aria-label={label}
            options={options}
            value={list}
            disabled={disabled}
            className={cn("min-h-8", className)}
            onChange={(next) => onChange(next)}
          />
        );
      }
      return (
        <Select<Primitive>
          id={id}
          aria-label={label}
          size={size}
          variant={variant}
          multiple
          options={options}
          value={list}
          allowClear
          disabled={disabled}
          status={status}
          placeholder={disabled ? "" : placeholderOf(field, "选择")}
          popupFooter={footer}
          className={className}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case "RELATION_OBJECT": {
      const multiple = widget.selectionMode === "MULTIPLE";
      const refs = toRefs(value);
      if (isPersonField(field)) {
        return (
          <PersonInput
            aria-label={label}
            size={size}
            variant={variant}
            multiple={multiple}
            value={refs}
            disabled={disabled}
            status={status}
            placeholder={disabled ? "" : widget.placeholder || "请选择人员"}
            className={className}
            onChange={(next) => onChange(next)}
          />
        );
      }
      if (widget.displayMode === "DROPDOWN") {
        return (
          <ReferenceSelect
            aria-label={label}
            size={size}
            variant={variant}
            field={field}
            multiple={multiple}
            value={refs}
            disabled={disabled}
            status={status}
            placeholder={disabled ? "" : placeholderOf(field, "选择")}
            className={className}
            onChange={(next, records) => onChange(next, records)}
          />
        );
      }
      return (
        <ReferenceInput
          aria-label={label}
          size={size}
          variant={variant}
          field={field}
          multiple={multiple}
          value={refs}
          disabled={disabled}
          status={status}
          placeholder={disabled ? "" : placeholderOf(field, "选择")}
          className={className}
          onChange={(next, rows) => onChange(next, rows)}
        />
      );
    }
    case "IMAGE":
      return (
        <ImageUpload
          value={fileList(value)}
          maxCount={widget.maxCount ?? 9}
          maxSizeMb={widget.maxSizeMb ?? 2}
          accept={widget.allowedExtensions?.length ? widget.allowedExtensions.join(",") : undefined}
          readOnly={disabled && mode === "view"}
          disabled={disabled}
          size={compact ? 40 : 88}
          buttonText={compact ? "上传" : "上传图片"}
          className={className}
          onChange={(files) => onChange(files)}
        />
      );
    case "ATTACHMENT":
      return (
        <AttachmentUpload
          value={fileList(value)}
          maxCount={widget.maxCount ?? 9}
          maxSizeMb={widget.maxSizeMb ?? 20}
          accept={widget.allowedExtensions?.length ? widget.allowedExtensions.join(",") : undefined}
          readOnly={disabled && mode === "view"}
          disabled={disabled}
          hint={compact ? "" : undefined}
          className={className}
          onChange={(files) => onChange(files)}
        />
      );
    case "HYPERLINK": {
      const text = value === null || value === undefined ? "" : String(value);
      if (disabled && text) {
        return (
          <a
            href={/^(https?:)?\/\//i.test(text) ? text: `https://${text}`}
            target="_blank"
            rel="noreferrer"
            className={cn("inline-flex min-h-8 max-w-full items-center gap-1 truncate text-brand hover:underline", className)}
          >
            <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{text}</span>
          </a>
        );
      }
      return (
        <Input
          id={id}
          aria-label={label}
          size={size}
          variant={variant}
          prefix={<Link2 />}
          value={text}
          disabled={disabled}
          status={status}
          allowClear={!disabled}
          placeholder={disabled ? undefined : placeholderOf(field, "输入")}
          className={className}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case "RELATION_ATTRIBUTE":
    case "RELATION_REFERENCE":
    default: {
      const targetType = field.type === "RELATION_REFERENCE" ? widget.fieldType : undefined;
      if (targetType === "IMAGE" || targetType === "ATTACHMENT") {
        return <FieldControl field={{ ...field, type: targetType }} value={value} onChange={onChange} disabled mode="view" compact={compact} className={className} />;
      }
      return (
        <Input
          id={id}
          aria-label={label}
          size={size}
          variant={variant}
          value={formatFieldValue(field, value, { plain: true })}
          disabled
          placeholder={widget.placeholder}
          className={className}
        />
      );
    }
  }
}
