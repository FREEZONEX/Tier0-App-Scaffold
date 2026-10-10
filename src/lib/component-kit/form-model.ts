/**
 * Form rules shared by MetaForm, DetailTable and page code: visibility,
 * read-only state, default values, fill rules and validation messages
 *.
 */
import { isEmptyValue, isRefValue, roundTo, shanghaiToday, toNumber } from "@/lib/component-kit/format";
import type { FieldDef, FieldWidget, RefValue, SectionDef } from "@/lib/component-kit/types";

export type FormMode = "create" | "edit" | "view";
export type FormValues = Record<string, unknown>;
export type FormErrors = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Visibility / read-only                                               */
/* ------------------------------------------------------------------ */

function matchesCondition(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) return expected.some((item) => matchesCondition(item, actual));
  if (expected === null) return isEmptyValue(actual);
  if (typeof expected === "boolean") return Boolean(actual) === expected;
  if (isRefValue(actual)) return String(actual.id) === String(expected);
  return String(actual ?? "") === String(expected);
}

/** `widget.visibleWhen` = every key matches (array = any of). */
export function matchesVisibleWhen(widget: FieldWidget | undefined, values: FormValues): boolean {
  const condition = widget?.visibleWhen;
  if (!condition) return true;
  return Object.entries(condition).every(([code, expected]) => matchesCondition(expected, values[code]));
}

/** Rendered in a form: not `visible: false` / `hidden`, and `visibleWhen` holds. */
export function isFormFieldVisible(field: FieldDef, values: FormValues): boolean {
  const widget = field.widget ?? {};
  if (widget.visible === false || widget.hidden === true) return false;
  return matchesVisibleWhen(widget, values);
}

export function isFieldReadonly(field: FieldDef, mode: FormMode): boolean {
  if (mode === "view") return true;
  const widget = field.widget ?? {};
  if (widget.readonly) return true;
  return mode === "edit" && widget.readonlyOnEdit === true;
}

/** RELATION_ATTRIBUTE / RELATION_REFERENCE values are always derived. */
export function isDerivedField(field: FieldDef): boolean {
  return field.type === "RELATION_ATTRIBUTE" || field.type === "RELATION_REFERENCE";
}

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

export function defaultFieldValue(field: FieldDef, now: Date = new Date()): unknown {
  const widget = field.widget ?? {};
  if (widget.defaultValue !== undefined && widget.defaultValue !== null && widget.defaultValue !== "") {
    return widget.defaultValue;
  }
  if (field.type === "DATETIME" && widget.defaultNow) {
    const precision = widget.displayPrecision ?? widget.dateTimeDisplayType ?? "DATETIME_SECOND";
    return precision === "DATE" ? shanghaiToday(now) : now.toISOString();
  }
  if (field.type === "SINGLE_SELECT") {
    const option = field.options?.find((item) => item.isDefault);
    if (option) return option.value;
  }
  if (field.type === "MULTI_SELECT") {
    const options = field.options?.filter((item) => item.isDefault) ?? [];
    if (options.length) return options.map((item) => item.value);
  }
  return undefined;
}

/** Defaults for every form item of the form sections (tables are left to the caller). */
export function buildDefaultValues(sections: readonly SectionDef[], now: Date = new Date()): FormValues {
  const values: FormValues = {};
  for (const section of sections) {
    if (section.type !== "form") continue;
    for (const field of section.items) {
      if (field.code in values) continue;
      const value = defaultFieldValue(field, now);
      if (value !== undefined) values[field.code] = value;
    }
  }
  return values;
}

/** Default values for a new detail row. */
export function buildDefaultRow(items: readonly FieldDef[], now: Date = new Date()): FormValues {
  const row: FormValues = {};
  for (const field of items) {
    const value = defaultFieldValue(field, now);
    if (value !== undefined) row[field.code] = value;
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* Relations                                                            */
/* ------------------------------------------------------------------ */

/** Snapshot of a picked record: `{ id, name, code }` using the reference label field. */
export function toRefValue(record: Record<string, unknown>, field: Pick<FieldDef, "reference">): RefValue {
  const labelField = field.reference?.labelField ?? "name";
  const valueField = field.reference?.valueField ?? "id";
  const id = String(record[valueField] ?? record.id ?? "");
  const nameCandidate = record[labelField] ?? record.name ?? record.code ?? id;
  const codeCandidate = record.code ?? null;
  return {
    id,
    name: String(nameCandidate ?? ""),
    code: codeCandidate === null || codeCandidate === undefined ? null : String(codeCandidate),
  };
}

/**
 * Apply `widget.fillRules` after picking a relation: copy `record[sourceField]`
 * into `values[targetField]` (cleared when the relation is cleared).
 */
export function applyFillRules(
  field: FieldDef,
  record: Record<string, unknown> | null,
  values: FormValues,
): FormValues {
  const rules = field.widget?.fillRules;
  if (!rules?.length) return values;
  const next = { ...values };
  for (const rule of rules) {
    if (!record) {
      next[rule.targetField] = null;
      continue;
    }
    // Source fields the picked record does not carry are left to page code.
    if (!(rule.sourceField in record)) continue;
    next[rule.targetField] = record[rule.sourceField] ?? null;
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

export function requiredMessage(field: FieldDef): string {
  switch (field.type) {
    case "TEXT":
    case "NUMBER":
    case "HYPERLINK":
      return `请输入${field.name}`;
    case "IMAGE":
    case "ATTACHMENT":
      return `请上传${field.name}`;
    default:
      return `请选择${field.name}`;
  }
}

function decimalCount(value: number): number {
  const text = String(value);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  const fraction = text.split(".")[1];
  return fraction ? fraction.length : 0;
}

/** Validate one value; returns an error message or null. */
export function validateFieldValue(field: FieldDef, value: unknown): string | null {
  const widget = field.widget ?? {};
  if (widget.required && isEmptyValue(value)) return requiredMessage(field);
  if (isEmptyValue(value)) return null;
  if (field.type === "NUMBER") {
    const numeric = toNumber(value);
    if (numeric === null) return `${field.name}须为数字`;
    if (typeof widget.minValue === "number" && numeric < widget.minValue) {
      return widget.minValue > 0 && widget.minValue < 1 ? `${field.name}须为正数` : `${field.name}不能小于${widget.minValue}`;
    }
    if (typeof widget.maxValue === "number" && numeric > widget.maxValue) {
      return `${field.name}不能大于${widget.maxValue}`;
    }
    if (typeof widget.decimalPlaces === "number" && decimalCount(numeric) > widget.decimalPlaces) {
      return widget.decimalPlaces === 0 ? `${field.name}须为整数` : `${field.name}最多${widget.decimalPlaces}位小数`;
    }
    if (typeof widget.integerPlaces === "number" && String(Math.trunc(Math.abs(numeric))).length > widget.integerPlaces) {
      return `${field.name}整数位最多${widget.integerPlaces}位`;
    }
  }
  if (field.type === "TEXT" && typeof value === "string" && widget.maxLength && value.length > widget.maxLength) {
    return `${field.name}最多${widget.maxLength}个字符`;
  }
  if (field.type === "HYPERLINK" && typeof value === "string" && !/^(https?:\/\/|\/)/i.test(value.trim())) {
    return `${field.name}须以 http:// 或 https:// 开头`;
  }
  return null;
}

/** Validate the visible, editable items of form sections. */
export function validateFormSections(
  sections: readonly SectionDef[],
  values: FormValues,
  mode: FormMode,
): FormErrors {
  const errors: FormErrors = {};
  if (mode === "view") return errors;
  for (const section of sections) {
    if (section.type !== "form") continue;
    for (const field of section.items) {
      if (!isFormFieldVisible(field, values)) continue;
      if (isFieldReadonly(field, mode) && !field.widget?.required) continue;
      if (isDerivedField(field)) continue;
      const message = validateFieldValue(field, values[field.code]);
      if (message) errors[field.code] = message;
    }
  }
  return errors;
}

export interface RowError {
  rowIndex: number;
  field: string;
  message: string;
}

/** Validate detail rows; messages carry the 1-based row number (第 n 行…). */
export function validateRows(items: readonly FieldDef[], rows: readonly FormValues[], mode: FormMode = "create"): RowError[] {
  const errors: RowError[] = [];
  if (mode === "view") return errors;
  rows.forEach((row, rowIndex) => {
    for (const field of items) {
      if (field.widget?.visible === false) continue;
      if (isDerivedField(field)) continue;
      const value = row[field.code];
      const widget = field.widget ?? {};
      // Always-readonly columns (序号 seq, 带出的快照…) are produced by the server
      // or fill rules; the server validates them, so new rows must not block here.
      if (widget.readonly === true) continue;
      if (widget.required && isEmptyValue(value)) {
        errors.push({ rowIndex, field: field.code, message: `第${rowIndex + 1}行${field.name}必填` });
        continue;
      }
      if (isFieldReadonly(field, mode)) continue;
      const message = validateFieldValue({ ...field, widget: { ...widget, required: false } }, value);
      if (message) errors.push({ rowIndex, field: field.code, message: `第${rowIndex + 1}行${message}` });
    }
  });
  return errors;
}

/** Round a numeric input to the widget precision (keeps null for empty). */
export function normalizeNumberInput(value: unknown, widget: FieldWidget | undefined): number | null {
  const numeric = toNumber(value);
  if (numeric === null) return null;
  return typeof widget?.decimalPlaces === "number" ? roundTo(numeric, widget.decimalPlaces) : numeric;
}

/** Sum a numeric column (合计行). */
export function sumColumn(rows: readonly FormValues[], code: string): number {
  return rows.reduce((total, row) => total + (toNumber(row[code]) ?? 0), 0);
}

/** Remove DetailTable's client-only `__key` from rows before submitting. */
export function stripRowKeys<T extends FormValues>(rows: readonly T[]): Omit<T, "__key">[] {
  return rows.map((row) => {
    const { __key: _key, ...rest } = row;
    return rest;
  });
}

/** Rows of every table section, keyed by section key (for submit payloads). */
export function tableSectionRows(sections: readonly SectionDef[], values: FormValues): Record<string, FormValues[]> {
  const result: Record<string, FormValues[]> = {};
  for (const section of sections) {
    if (section.type !== "table") continue;
    const rows = values[section.key];
    result[section.key] = Array.isArray(rows) ? stripRowKeys(rows as FormValues[]) : [];
  }
  return result;
}
