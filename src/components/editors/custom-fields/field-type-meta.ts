/**
 * 自定义配置（06）: field type labels / tag colors and the editor draft model shared by
 * the field list page and the 创建 / 编辑自定义字段 page.
 */
import { CUSTOM_FIELD_TYPES, type CustomFieldInput, type CustomFieldRecord, type DisplayPrecision, type FieldType, type SelectOption } from "@/lib/component-kit/types";

export const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(CUSTOM_FIELD_TYPES.map((item) => [item.key, item.label]));

/** Tag colors (灵动 900_cc_workorder.png: 文本蓝、单选框/关联引用绿、图片金、附件橙). */
export const FIELD_TYPE_COLOR: Record<string, string> = {
  TEXT: "#050b14",
  NUMBER: "#0891b2",
  DATETIME: "#7c3aed",
  SINGLE_SELECT: "#10b981",
  MULTI_SELECT: "#16a34a",
  IMAGE: "#d99a00",
  ATTACHMENT: "#f97316",
  HYPERLINK: "#4f46e5",
  RELATION_REFERENCE: "#10b981",
};

export const DISPLAY_PRECISION_OPTIONS: { value: DisplayPrecision; label: string }[] = [
  { value: "DATETIME_SECOND", label: "年-月-日 时:分:秒" },
  { value: "DATE", label: "年-月-日" },
  { value: "DATETIME_MINUTE", label: "年-月-日 时:分" },
];

export const DISPLAY_MODE_OPTIONS: { value: "DROPDOWN" | "FLAT"; label: string }[] = [
  { value: "DROPDOWN", label: "下拉选择" },
  { value: "FLAT", label: "平铺" },
];

/** Preset option colors (灵动 option color picker). */
export const OPTION_COLORS = [
  "#1f1f1f",
  "#8c8c8c",
  "#f5222d",
  "#fa541c",
  "#fa8c16",
  "#9a3412",
  "#fadb14",
  "#a0d911",
  "#166534",
  "#13c2c2",
  "#050b14",
  "#2f54eb",
  "#722ed1",
  "#eb2f96",
];

export const MAX_OPTIONS = 100;
export const OPTION_MAX_LENGTH = 100;
export const NAME_MAX_LENGTH = 50;
export const TOOLTIP_MAX_LENGTH = 50;
export const PLACEHOLDER_MAX_LENGTH = 50;
export const IMAGE_LIMITS = { maxCount: 9, defaultSizeMb: 2, maxSizeMb: 10 } as const;
export const ATTACHMENT_LIMITS = { maxCount: 9, defaultSizeMb: 20, maxSizeMb: 20 } as const;

export interface OptionDraft {
  key: string;
  label: string;
  color: string;
  isDefault: boolean;
}

export interface FieldDraft {
  name: string;
  type: FieldType;
  required: boolean;
  multiline: boolean;
  thousandSeparator: boolean;
  useDecimalPlaces: boolean;
  decimalPlaces: number | null;
  useDefaultValue: boolean;
  defaultValue: number | null;
  defaultNow: boolean;
  displayPrecision: DisplayPrecision;
  allowUserAddOption: boolean;
  displayMode: "DROPDOWN" | "FLAT";
  options: OptionDraft[];
  maxCount: number | null;
  maxSizeMb: number | null;
  referencePath: string[];
  placeholder: string;
  tooltip: string;
}

let optionSeed = 0;

export function newOptionKey(): string {
  optionSeed += 1;
  return `option-${Date.now().toString(36)}-${optionSeed}`;
}

export function emptyOption(isDefault = false): OptionDraft {
  return { key: newOptionKey(), label: "", color: OPTION_COLORS[0], isDefault };
}

export function emptyDraft(type: FieldType = "TEXT"): FieldDraft {
  return {
    name: "",
    type,
    required: false,
    multiline: false,
    thousandSeparator: false,
    useDecimalPlaces: false,
    decimalPlaces: 2,
    useDefaultValue: false,
    defaultValue: null,
    defaultNow: false,
    displayPrecision: "DATETIME_SECOND",
    allowUserAddOption: false,
    displayMode: "DROPDOWN",
    options: [emptyOption(true)],
    maxCount: type === "ATTACHMENT" ? ATTACHMENT_LIMITS.maxCount : IMAGE_LIMITS.maxCount,
    maxSizeMb: type === "ATTACHMENT" ? ATTACHMENT_LIMITS.defaultSizeMb : IMAGE_LIMITS.defaultSizeMb,
    referencePath: [],
    placeholder: "",
    tooltip: "",
  };
}

/** Switching the type in the create form keeps the shared attributes. */
export function changeDraftType(draft: FieldDraft, type: FieldType): FieldDraft {
  const fresh = emptyDraft(type);
  return { ...fresh, name: draft.name, required: type === "RELATION_REFERENCE" ? false : draft.required, placeholder: draft.placeholder, tooltip: draft.tooltip };
}

export function draftFromRecord(record: CustomFieldRecord): FieldDraft {
  const widget = record.widget ?? {};
  const base = emptyDraft(record.type);
  const options: OptionDraft[] = (record.options ?? []).map((option: SelectOption) => ({
    key: newOptionKey(),
    label: String(option.label ?? option.value ?? ""),
    color: option.color || OPTION_COLORS[0],
    isDefault: option.isDefault === true,
  }));
  return {
    ...base,
    name: record.name,
    required: widget.required === true,
    multiline: widget.multiline === true,
    thousandSeparator: widget.thousandSeparator === true,
    useDecimalPlaces: widget.decimalPlaces !== undefined && widget.decimalPlaces !== null,
    decimalPlaces: typeof widget.decimalPlaces === "number" ? widget.decimalPlaces : base.decimalPlaces,
    useDefaultValue: widget.defaultValue !== undefined && widget.defaultValue !== null && widget.defaultValue !== "",
    defaultValue: typeof widget.defaultValue === "number" ? widget.defaultValue : widget.defaultValue ? Number(widget.defaultValue) : null,
    defaultNow: widget.defaultNow === true,
    displayPrecision: widget.displayPrecision ?? base.displayPrecision,
    allowUserAddOption: widget.allowUserAddOption === true,
    displayMode: widget.displayMode === "FLAT" ? "FLAT" : "DROPDOWN",
    options: options.length ? options : base.options,
    maxCount: typeof widget.maxCount === "number" ? widget.maxCount : base.maxCount,
    maxSizeMb: typeof widget.maxSizeMb === "number" ? widget.maxSizeMb : base.maxSizeMb,
    referencePath: Array.isArray(widget.referencePath) ? widget.referencePath.map(String) : [],
    placeholder: widget.placeholder ?? "",
    tooltip: widget.tooltip ?? "",
  };
}

export type DraftErrors = Partial<Record<"name" | "type" | "options" | "decimalPlaces" | "defaultValue" | "referencePath" | "maxCount" | "maxSizeMb", string>>;

function decimalsOf(value: number): number {
  const text = String(value);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

/** Client-side checks with the same rules as the service (the service checks again). */
export function validateDraft(draft: FieldDraft): DraftErrors {
  const errors: DraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "请输入字段名称";
  else if (name.length > NAME_MAX_LENGTH) errors.name = `字段名称最多 ${NAME_MAX_LENGTH} 个字`;
  switch (draft.type) {
    case "NUMBER":
      if (draft.useDecimalPlaces && (draft.decimalPlaces === null || !Number.isInteger(draft.decimalPlaces) || draft.decimalPlaces < 0 || draft.decimalPlaces > 6)) {
        errors.decimalPlaces = "小数位数只能是 0 到 6 的整数";
      }
      if (draft.useDefaultValue) {
        if (draft.defaultValue === null || !Number.isFinite(draft.defaultValue)) errors.defaultValue = "请输入默认值";
        else if (draft.useDecimalPlaces && draft.decimalPlaces !== null && decimalsOf(draft.defaultValue) > draft.decimalPlaces) {
          errors.defaultValue = `默认值最多 ${draft.decimalPlaces} 位小数`;
        }
      }
      break;
    case "SINGLE_SELECT":
    case "MULTI_SELECT": {
      const labels = draft.options.map((option) => option.label.trim());
      if (labels.length === 0) errors.options = "请至少设置一个可选项";
      else if (labels.some((label) => !label)) errors.options = "选项内容不能为空";
      else if (labels.length > MAX_OPTIONS) errors.options = `最多${MAX_OPTIONS}个选项`;
      else {
        const duplicate = labels.find((label, index) => labels.indexOf(label) !== index);
        if (duplicate) errors.options = `选项「${duplicate}」重复`;
      }
      break;
    }
    case "IMAGE":
    case "ATTACHMENT": {
      const limits = draft.type === "IMAGE" ? IMAGE_LIMITS : ATTACHMENT_LIMITS;
      if (draft.maxCount === null || !Number.isInteger(draft.maxCount) || draft.maxCount < 1 || draft.maxCount > limits.maxCount) {
        errors.maxCount = `最多上传数量只能是 1 到 ${limits.maxCount}`;
      }
      if (draft.maxSizeMb === null || draft.maxSizeMb <= 0 || draft.maxSizeMb > limits.maxSizeMb) {
        errors.maxSizeMb = `单个文件大小上限不能超过 ${limits.maxSizeMb}MB`;
      }
      break;
    }
    case "RELATION_REFERENCE":
      if (draft.referencePath.length < 2) errors.referencePath = "请选择引用字段";
      break;
    default:
      break;
  }
  return errors;
}

/** Draft → API body (CustomFieldInput). */
export function draftToInput(draft: FieldDraft): CustomFieldInput {
  const widget: CustomFieldInput["widget"] = { required: draft.required };
  const withTexts = draft.type !== "IMAGE" && draft.type !== "ATTACHMENT" && draft.type !== "RELATION_REFERENCE" && draft.type !== "DATETIME";
  if (withTexts) {
    widget.placeholder = draft.placeholder.trim();
    widget.tooltip = draft.tooltip.trim();
  }
  let options: SelectOption[] | undefined;
  switch (draft.type) {
    case "TEXT":
      widget.multiline = draft.multiline;
      break;
    case "NUMBER":
      widget.thousandSeparator = draft.thousandSeparator;
      if (draft.useDecimalPlaces && draft.decimalPlaces !== null) widget.decimalPlaces = draft.decimalPlaces;
      if (draft.useDefaultValue && draft.defaultValue !== null) widget.defaultValue = draft.defaultValue;
      break;
    case "DATETIME":
      widget.defaultNow = draft.defaultNow;
      widget.displayPrecision = draft.displayPrecision;
      break;
    case "SINGLE_SELECT":
    case "MULTI_SELECT":
      widget.allowUserAddOption = draft.allowUserAddOption;
      widget.displayMode = draft.displayMode;
      options = draft.options.map((option) => ({ value: option.label.trim(), label: option.label.trim(), color: option.color, isDefault: option.isDefault }));
      break;
    case "IMAGE":
    case "ATTACHMENT":
      widget.maxCount = draft.maxCount ?? undefined;
      widget.maxSizeMb = draft.maxSizeMb ?? undefined;
      break;
    case "RELATION_REFERENCE":
      widget.referencePath = draft.referencePath;
      widget.required = false;
      break;
    default:
      break;
  }
  return { name: draft.name.trim(), type: draft.type, widget, ...(options ? { options } : {}) };
}

/** 批量编辑: one option per line, duplicates and blank lines dropped, keeps colors / defaults of existing labels. */
export function optionsFromLines(text: string, current: readonly OptionDraft[]): { options: OptionDraft[]; error: string | null } {
  const labels: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const label = line.trim();
    if (label && !labels.includes(label)) labels.push(label);
  }
  if (labels.length === 0) return { options: [], error: "请至少输入一个选项" };
  if (labels.length > MAX_OPTIONS) return { options: [], error: `最多${MAX_OPTIONS}个选项，当前 ${labels.length} 个` };
  const tooLong = labels.find((label) => label.length > OPTION_MAX_LENGTH);
  if (tooLong) return { options: [], error: `选项「${tooLong.slice(0, 20)}…」超过 ${OPTION_MAX_LENGTH} 个字` };
  const byLabel = new Map(current.map((option) => [option.label.trim(), option]));
  return {
    options: labels.map((label) => {
      const existing = byLabel.get(label);
      return existing ? { ...existing, label } : { key: newOptionKey(), label, color: OPTION_COLORS[0], isDefault: false };
    }),
    error: null,
  };
}
