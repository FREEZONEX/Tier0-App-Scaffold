"use client";

/**
 * Picker-backed inputs (参照输入框, right side 放大镜):
 * - PersonInput → PersonPicker (人员, single / multiple)
 * - ReferenceInput → ReferencePicker (对象参照弹窗)
 * Multiple values render as closable tags; × clears on hover.
 */
import { CircleX, Search } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  CONTROL_PADDING_X,
  controlFrameClass,
  type ControlSize,
  type ControlStatus,
  type ControlVariant,
} from "@/components/kit/ui/control-styles";
import { Tag } from "@/components/kit/ui/tag";
import { isRefValue } from "@/lib/component-kit/format";
import type { FieldDef, QueryFilter, RefValue } from "@/lib/component-kit/types";
import type { ListRow } from "@/lib/component-kit/use-list-controller";
import { cn } from "@/lib/utils";
import { PersonPicker } from "@/components/kit/meta/person-picker";
import { ReferencePicker } from "@/components/kit/meta/reference-picker";

type RefInputValue = RefValue | RefValue[] | null;

interface PickerFrameProps {
  value: RefInputValue;
  multiple: boolean;
  placeholder: string;
  disabled: boolean;
  status?: ControlStatus;
  size: ControlSize;
  variant: ControlVariant;
  active: boolean;
  className?: string;
  ariaLabel?: string;
  onOpen: () => void;
  onChange: (value: RefInputValue) => void;
}

function toList(value: RefInputValue): RefValue[] {
  if (Array.isArray(value)) return value.filter(isRefValue);
  return isRefValue(value) ? [value] : [];
}

function PickerFrame({
  value,
  multiple,
  placeholder,
  disabled,
  status,
  size,
  variant,
  active,
  className,
  ariaLabel,
  onOpen,
  onChange,
}: PickerFrameProps) {
  const items = toList(value);
  const empty = items.length === 0;
  return (
    <div
      role="combobox"
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={active}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      data-bare-control=""
      className={cn(
        controlFrameClass({ size, status, variant, disabled, active }),
        "group cursor-pointer gap-1 py-[3px]",
        CONTROL_PADDING_X[size],
        disabled && "cursor-not-allowed",
        className,
      )}
      onClick={() => {
        if (!disabled) onOpen();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {empty ? (
          <span className="truncate text-text-placeholder">{placeholder}</span>
        ) : multiple ? (
          items.map((item) => (
            <Tag
              key={item.id}
              size="sm"
              closable={!disabled}
              className="max-w-[10rem] bg-[#f3f3f3]"
              bordered={false}
              title={item.code ? `${item.name}（${item.code}）` : item.name}
              onClose={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onChange(items.filter((other) => other.id !== item.id));
              }}
            >
              {item.name}
            </Tag>
          ))
        ) : (
          <span className="truncate" title={items[0].code ? `${items[0].name}（${items[0].code}）` : items[0].name}>
            {items[0].name}
          </span>
        )}
      </span>
      {!empty && !disabled ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="清除"
          className="hidden shrink-0 items-center text-text-placeholder hover:text-text-tertiary group-hover:flex"
          onClick={(event) => {
            event.stopPropagation();
            onChange(multiple ? [] : null);
          }}
        >
          <CircleX className="size-3.5" />
        </button>
      ) : null}
      <Search className={cn("size-3.5 shrink-0 text-text-tertiary", !empty && !disabled && "group-hover:hidden")} aria-hidden="true" />
    </div>
  );
}

interface BaseInputProps {
  value: RefInputValue;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  status?: ControlStatus;
  size?: ControlSize;
  variant?: ControlVariant;
  className?: string;
  "aria-label"?: string;
}

export interface PersonInputProps extends BaseInputProps {
  onChange: (value: RefInputValue) => void;
  /** Dialog title (default 选择人员). */
  title?: string;
}

export function PersonInput({
  value,
  onChange,
  multiple = false,
  placeholder = "请选择人员",
  disabled = false,
  status,
  size = "md",
  variant = "outlined",
  className,
  title,
  "aria-label": ariaLabel,
}: PersonInputProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerFrame
        value={value}
        multiple={multiple}
        placeholder={placeholder}
        disabled={disabled}
        status={status}
        size={size}
        variant={variant}
        active={open}
        className={className}
        ariaLabel={ariaLabel}
        onOpen={() => setOpen(true)}
        onChange={onChange}
      />
      <PersonPicker
        open={open}
        onOpenChange={setOpen}
        multiple={multiple}
        value={value}
        title={title}
        onConfirm={(persons) => onChange(multiple ? persons : persons[0] ?? null)}
      />
    </>
  );
}

export interface ReferenceInputProps extends BaseInputProps {
  /** Relation field (reference target, widget.params, selectionMode). */
  field?: Pick<FieldDef, "reference" | "widget" | "name">;
  /** Target objectCode when no field is given. */
  objectCode?: string;
  title?: string;
  fixedFilters?: QueryFilter[];
  isRowSelectable?: (row: ListRow) => boolean;
  /** New value plus the picked records (for fillRules). */
  onChange: (value: RefInputValue, rows: ListRow[]) => void;
}

export function ReferenceInput({
  value,
  onChange,
  field,
  objectCode,
  title,
  fixedFilters,
  isRowSelectable,
  multiple,
  placeholder,
  disabled = false,
  status,
  size = "md",
  variant = "outlined",
  className,
  "aria-label": ariaLabel,
}: ReferenceInputProps) {
  const [open, setOpen] = useState(false);
  const target = objectCode ?? field?.reference?.objectCode;
  const isMultiple = multiple ?? field?.widget?.selectionMode === "MULTIPLE";
  if (target === "person") {
    return (
      <PersonInput
        value={value}
        onChange={(next) => onChange(next, [])}
        multiple={isMultiple}
        placeholder={placeholder}
        disabled={disabled}
        status={status}
        size={size}
        variant={variant}
        className={className}
        aria-label={ariaLabel}
      />
    );
  }
  return (
    <>
      <PickerFrame
        value={value}
        multiple={isMultiple}
        placeholder={placeholder ?? field?.widget?.placeholder ?? (field ? `请选择${field.name}` : "请选择")}
        disabled={disabled || !target}
        status={status}
        size={size}
        variant={variant}
        active={open}
        className={className}
        ariaLabel={ariaLabel}
        onOpen={() => setOpen(true)}
        onChange={(next) => onChange(next, [])}
      />
      {target ? (
        <ReferencePicker
          open={open}
          onOpenChange={setOpen}
          objectCode={target}
          title={title}
          multiple={isMultiple}
          value={value}
          field={field}
          params={field?.widget?.params}
          fixedFilters={fixedFilters}
          isRowSelectable={isRowSelectable}
          onConfirm={(rows, refs) => onChange(isMultiple ? refs : refs[0] ?? null, rows)}
        />
      ) : null}
    </>
  );
}
