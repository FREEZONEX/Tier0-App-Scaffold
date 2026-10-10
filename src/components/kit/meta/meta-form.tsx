"use client";

/**
 * MetaForm — renders `EffectivePageConfig.formSections` (standard + custom
 * fields): collapsible sections (「▼ 基础信息」, data-anchor-key for AnchorTabs),
 * form items in a responsive grid (1 → 2 → 3 columns by container width, so
 * dialogs stay at 2; `columns={4}` reaches 4 in wide containers), label on top (vertical) or left with colon (horizontal),
 * required marks, ⓘ tooltips, errors under the field, and table sections as
 * DetailTable bound to `value[section.key]`.
 *
 * Controlled: `value` + `onChange(next, change)`; relation picks apply
 * `widget.fillRules`. `mode="view"` makes everything read-only.
 * `formRef.current.validate()` checks required / number rules and detail rows.
 */
import { CircleQuestionMark } from "lucide-react";
import {
  useCallback,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { toast } from "sonner";
import { FieldLabel } from "@/components/forms/field-label";
import { CollapseSection } from "@/components/kit/ui/collapse-section";
import { Tooltip } from "@/components/kit/ui/tooltip";
import {
  applyFillRules,
  isDerivedField,
  isFieldReadonly,
  isFormFieldVisible,
  validateFormSections,
  validateRows,
  type FormErrors,
  type FormMode,
  type FormValues,
  type RowError,
} from "@/lib/component-kit/form-model";
import type { FieldDef, SectionDef, SelectOption } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { DetailTable, type DetailTableProps } from "@/components/kit/meta/detail-table";
import { FieldControl } from "@/components/kit/meta/field-control";

export interface FieldChange {
  code: string;
  value: unknown;
  /** Picked records of relation fields (fillRules already applied to `next`). */
  records?: Record<string, unknown>[];
}

export interface FieldRenderContext {
  field: FieldDef;
  value: unknown;
  values: FormValues;
  mode: FormMode;
  readonly: boolean;
  error?: string;
  onChange: (value: unknown, records?: Record<string, unknown>[]) => void;
}

export interface SectionSlotContext {
  section: SectionDef;
  values: FormValues;
  mode: FormMode;
  onChange: (next: FormValues, change: FieldChange) => void;
}

export interface MetaFormHandle {
  /** Validate visible items and default-rendered detail tables; shows errors, returns true when valid. */
  validate: () => boolean;
  /** Clear displayed errors. */
  resetErrors: () => void;
}

export interface MetaFormProps {
  /** `config.formSections`. */
  sections: readonly SectionDef[];
  value: FormValues;
  onChange: (next: FormValues, change: FieldChange) => void;
  mode?: FormMode;
  /** vertical = label on top ; horizontal = label left with colon. */
  layout?: "horizontal" | "vertical";
  /**
   * Max column count; "auto" = 1 / 2 / 3 by container width (default). 4 = 宽屏多列表单
   * (1 → 2 → 3 → 4 as the container widens; phones stay at 1).
   */
  columns?: 1 | 2 | 3 | 4 | "auto";
  /** Object code (custom select 「允许用户添加选项」). */
  objectCode?: string;
  /** Extra errors from the server or page rules, keyed by field code. */
  errors?: FormErrors;
  /** Replace the content of a section (keeps the collapsible header). */
  sectionSlots?: Record<string, ReactNode | ((context: SectionSlotContext) => ReactNode)>;
  /** Replace the control of a single field. */
  renderField?: Record<string, (context: FieldRenderContext) => ReactNode>;
  /** Content at the right of a label (「＋ 创建」). */
  labelExtra?: Record<string, ReactNode>;
  /** Content under a control (KPI cards, 逾期提示). */
  fieldAddon?: Record<string, ReactNode>;
  hiddenFields?: readonly string[];
  readonlyFields?: readonly string[];
  /** DetailTable props per table section key (picker, toolbarExtra, summaryFields…). */
  tableProps?: Record<string, Partial<DetailTableProps> & { minRows?: number }>;
  /** Section titles (default: when there is more than one section). */
  showSectionTitles?: boolean;
  collapsible?: boolean;
  formRef?: Ref<MetaFormHandle>;
  className?: string;
}

const GRID_BY_COLUMNS: Record<"1" | "2" | "3" | "4" | "auto", string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 @lg:grid-cols-2",
  "3": "grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3",
  "4": "grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4",
  auto: "grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3",
};

function isWideField(field: FieldDef): boolean {
  return field.type === "ATTACHMENT";
}

function FormItem({
  field,
  values,
  mode,
  layout,
  readonly,
  error,
  objectCode,
  renderField,
  labelExtra,
  addon,
  extraOptions,
  onOptionAdded,
  onFieldChange,
}: {
  field: FieldDef;
  values: FormValues;
  mode: FormMode;
  layout: "horizontal" | "vertical";
  readonly: boolean;
  error?: string;
  objectCode?: string;
  renderField?: (context: FieldRenderContext) => ReactNode;
  labelExtra?: ReactNode;
  addon?: ReactNode;
  extraOptions?: SelectOption[];
  onOptionAdded: (option: SelectOption) => void;
  onFieldChange: (field: FieldDef, value: unknown, records?: Record<string, unknown>[]) => void;
}) {
  const id = useId();
  const value = values[field.code];
  const widget = field.widget ?? {};
  const horizontal = layout === "horizontal";
  const onChange = (next: unknown, records?: Record<string, unknown>[]) => onFieldChange(field, next, records);
  const control = renderField ? (
    renderField({ field, value, values, mode, readonly, error, onChange })
  ) : (
    <FieldControl
      id={id}
      field={field}
      value={value}
      mode={mode}
      disabled={readonly}
      status={error ? "error" : undefined}
      objectCode={objectCode}
      extraOptions={extraOptions}
      onOptionAdded={onOptionAdded}
      onChange={onChange}
    />
  );

  return (
    <div
      data-field-code={field.code}
      className={cn(
        "min-w-0",
        horizontal ? "grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-start gap-x-3" : "flex flex-col gap-1.5",
        isWideField(field) && "@lg:col-span-2",
      )}
    >
      <div className={cn("flex min-h-[22px] min-w-0 items-center gap-1", horizontal && "min-h-8 justify-end")}>
        <FieldLabel
          htmlFor={id}
          required={Boolean(widget.required)}
          className={cn("min-w-0 flex-row-reverse text-sm font-normal text-foreground", horizontal && "text-right")}
          title={field.name}
        >
          <span className="line-clamp-2">
            {field.name}
            {horizontal ? "：" : ""}
          </span>
        </FieldLabel>
        {widget.tooltip ? (
          <Tooltip title={widget.tooltip}>
            <span tabIndex={0} aria-label={widget.tooltip} className="inline-flex shrink-0 text-text-tertiary">
              <CircleQuestionMark className="size-3.5" />
            </span>
          </Tooltip>
        ) : null}
        {labelExtra ? <span className={cn("flex shrink-0 items-center", !horizontal && "ml-auto")}>{labelExtra}</span> : null}
      </div>
      <div className="min-w-0">
        {control}
        {addon ? <div className="mt-2 min-w-0">{addon}</div> : null}
        {error ? (
          <p role="alert" className="mt-1 text-xs leading-5 text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MetaForm({
  sections,
  value,
  onChange,
  mode = "create",
  layout = "vertical",
  columns = "auto",
  objectCode,
  errors,
  sectionSlots,
  renderField,
  labelExtra,
  fieldAddon,
  hiddenFields,
  readonlyFields,
  tableProps,
  showSectionTitles,
  collapsible = true,
  formRef,
  className,
}: MetaFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [innerErrors, setInnerErrors] = useState<FormErrors>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowError[]>>({});
  const [extraOptions, setExtraOptions] = useState<Record<string, SelectOption[]>>({});
  const titles = showSectionTitles ?? sections.length > 1;

  const hidden = useMemo(() => new Set(hiddenFields ?? []), [hiddenFields]);
  const forcedReadonly = useMemo(() => new Set(readonlyFields ?? []), [readonlyFields]);

  const effectiveSections = useMemo(
    () =>
      sections.map((section) =>
        section.type === "form"
          ? { ...section, items: section.items.filter((field) => !hidden.has(field.code)) }
          : section,
      ),
    [hidden, sections],
  );

  const fieldReadonly = useCallback(
    (field: FieldDef) => isFieldReadonly(field, mode) || forcedReadonly.has(field.code) || isDerivedField(field),
    [forcedReadonly, mode],
  );

  const handleFieldChange = (field: FieldDef, next: unknown, records?: Record<string, unknown>[]) => {
    let values: FormValues = { ...value, [field.code]: next };
    if (field.type === "RELATION_OBJECT") {
      const cleared = next === null || next === undefined || (Array.isArray(next) && next.length === 0);
      if (records?.[0]) values = applyFillRules(field, records[0], values);
      else if (cleared) values = applyFillRules(field, null, values);
    }
    if (innerErrors[field.code]) {
      setInnerErrors((current) => {
        const copy = { ...current };
        delete copy[field.code];
        return copy;
      });
    }
    onChange(values, { code: field.code, value: next, records });
  };

  const validate = useCallback(() => {
    const formErrors = validateFormSections(
      effectiveSections.map((section) =>
        section.type === "form"
          ? { ...section, items: section.items.filter((field) => !forcedReadonly.has(field.code) || field.widget?.required) }
          : section,
      ),
      value,
      mode,
    );
    const tableErrors: Record<string, RowError[]> = {};
    const messages: string[] = [];
    for (const section of effectiveSections) {
      if (section.type !== "table" || sectionSlots?.[section.key]) continue;
      const rows = Array.isArray(value[section.key]) ? (value[section.key] as FormValues[]) : [];
      const minRows = tableProps?.[section.key]?.minRows ?? 0;
      if (rows.length < minRows) messages.push(`请至少添加一条${section.label}`);
      const list = validateRows(section.items, rows, mode);
      if (list.length) {
        tableErrors[section.key] = list;
        messages.push(list[0].message);
      }
    }
    setInnerErrors(formErrors);
    setRowErrors(tableErrors);
    const firstField = Object.keys(formErrors)[0];
    if (firstField) {
      const element = containerRef.current?.querySelector(`[data-field-code="${CSS.escape(firstField)}"]`);
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      toast.error(formErrors[firstField]);
    } else if (messages.length) {
      toast.error(messages[0]);
    }
    return !firstField && messages.length === 0;
  }, [effectiveSections, forcedReadonly, mode, sectionSlots, tableProps, value]);

  useImperativeHandle(
    formRef,
    () => ({
      validate,
      resetErrors: () => {
        setInnerErrors({});
        setRowErrors({});
      },
    }),
    [validate],
  );

  const allErrors = { ...innerErrors, ...(errors ?? {}) };
  const gridClass = GRID_BY_COLUMNS[String(columns) as keyof typeof GRID_BY_COLUMNS] ?? GRID_BY_COLUMNS.auto;

  const renderSectionContent = (section: SectionDef) => {
    const slot = sectionSlots?.[section.key];
    if (slot !== undefined) {
      return typeof slot === "function" ? slot({ section, values: value, mode, onChange }) : slot;
    }
    if (section.type === "table") {
      const rows = Array.isArray(value[section.key]) ? (value[section.key] as FormValues[]) : [];
      const extra = tableProps?.[section.key] ?? {};
      const { minRows: _minRows, ...detailProps } = extra;
      return (
        <DetailTable
          aria-label={section.label}
          items={section.items}
          objectCode={section.objectCode}
          mode={mode}
          errors={rowErrors[section.key]}
          {...detailProps}
          rows={rows}
          onChange={(nextRows) => {
            if (rowErrors[section.key]) setRowErrors((current) => ({ ...current, [section.key]: [] }));
            onChange({ ...value, [section.key]: nextRows }, { code: section.key, value: nextRows });
          }}
        />
      );
    }
    const visible = section.items.filter((field) => isFormFieldVisible(field, value));
    if (visible.length === 0) return <p className="text-sm text-text-tertiary">暂无字段</p>;
    return (
      <div className="@container">
        <div className={cn("grid min-w-0 items-start gap-x-6 gap-y-4", gridClass)}>
          {visible.map((field) => (
            <FormItem
              key={field.code}
              field={field}
              values={value}
              mode={mode}
              layout={layout}
              readonly={fieldReadonly(field)}
              error={allErrors[field.code]}
              objectCode={objectCode}
              renderField={renderField?.[field.code]}
              labelExtra={labelExtra?.[field.code]}
              addon={fieldAddon?.[field.code]}
              extraOptions={extraOptions[field.code]}
              onOptionAdded={(option) =>
                setExtraOptions((current) => ({ ...current, [field.code]: [...(current[field.code] ?? []), option] }))
              }
              onFieldChange={handleFieldChange}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={cn("flex min-w-0 flex-col gap-5", className)}>
      {effectiveSections.map((section) =>
        titles ? (
          <CollapseSection
            key={section.key}
            anchorKey={section.key}
            title={section.label}
            collapsible={collapsible}
            // inline-size containment: wide detail tables scroll inside instead of
            // stretching the collapse grid track (and the drawer body) sideways.
            contentClassName="pt-3 [contain:inline-size]"
          >
            {renderSectionContent(section)}
          </CollapseSection>
        ) : (
          <section key={section.key} data-anchor-key={section.key} className="min-w-0 [contain:inline-size]">
            {renderSectionContent(section)}
          </section>
        ),
      )}
    </div>
  );
}
