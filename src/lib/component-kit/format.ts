/**
 * Field value → display text. Pure functions shared by the browser (lists,
 * forms, print preview, mobile cards) and the server (export, print render).
 *
 * Conventions:
 * - Empty values render as「-」(`EMPTY_TEXT`); exports use an empty cell.
 * - Timestamps arrive as ISO strings (UTC) and display in Asia/Shanghai.
 *   Date-only values ("YYYY-MM-DD") are calendar dates and never shift.
 * - Relations are `RefValue` snapshots (`{ id, name, code }`) or arrays of them.
 * - Images / attachments are `FileValue[]`.
 */
import type {
  DisplayPrecision,
  FieldDef,
  FieldWidget,
  FileValue,
  RefValue,
  SelectOption,
} from "@/lib/component-kit/types";

export const EMPTY_TEXT = "-";
export const APP_TIME_ZONE = "Asia/Shanghai";

/** Asia/Shanghai has had a fixed UTC+8 offset (no DST) since 1991. */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Generic helpers                                                      */
/* ------------------------------------------------------------------ */

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0 || value.every((item) => isEmptyValue(item));
  return false;
}

export function isRefValue(value: unknown): value is RefValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    "name" in (value as object)
  );
}

export function isFileValue(value: unknown): value is FileValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { url?: unknown }).url === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function pad2(value: number | string): string {
  return String(value).padStart(2, "0");
}

/* ------------------------------------------------------------------ */
/* Numbers                                                              */
/* ------------------------------------------------------------------ */

export interface NumberFormatOptions {
  /** Maximum fraction digits. */
  decimalPlaces?: number;
  thousandSeparator?: boolean;
  /** Keep trailing zeros (amounts: "1,200.00"). Default: trim ("1200.5"). */
  fixed?: boolean;
  suffix?: string;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const text = value.replaceAll(",", "").trim();
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Round half away from zero without the binary drift of `toFixed` (1.005 → 1.01). */
export function roundTo(value: number, decimalPlaces: number): number {
  const places = Math.max(0, Math.min(10, Math.trunc(decimalPlaces)));
  const sign = value < 0 ? -1 : 1;
  const rounded = Number(`${Math.round(Number(`${Math.abs(value)}e${places}`))}e-${places}`);
  return Number.isFinite(rounded) ? sign * rounded : value;
}

function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatNumber(value: unknown, options: NumberFormatOptions = {}): string {
  const numeric = toNumber(value);
  if (numeric === null) return EMPTY_TEXT;
  const places = Math.max(0, Math.min(10, Math.trunc(options.decimalPlaces ?? 6)));
  const rounded = roundTo(numeric, places);
  let text = (Object.is(rounded, -0) ? 0 : rounded).toFixed(places);
  if (!options.fixed && text.includes(".")) {
    text = text.replace(/\.?0+$/, "");
  }
  if (options.thousandSeparator) {
    const negative = text.startsWith("-");
    const body = negative ? text.slice(1) : text;
    const [integerPart, fraction] = body.split(".");
    text = `${negative ? "-" : ""}${groupThousands(integerPart)}${fraction ? `.${fraction}` : ""}`;
  }
  return options.suffix ? `${text}${options.suffix}` : text;
}

/** Number options implied by a field widget (amounts keep 2 fixed decimals). */
export function numberOptionsOf(widget: FieldWidget | undefined): NumberFormatOptions {
  const decimalPlaces = widget?.decimalPlaces ?? 6;
  const thousandSeparator = widget?.thousandSeparator === true;
  return {
    decimalPlaces,
    thousandSeparator,
    fixed: widget?.trimTrailingZeros === true ? false : thousandSeparator && decimalPlaces <= 2,
    suffix: widget?.suffix,
  };
}

/** Percent text for progress values stored as 0–100 numbers ("52.5%"). */
export function formatPercent(value: unknown, decimalPlaces = 2): string {
  const numeric = toNumber(value);
  if (numeric === null) return EMPTY_TEXT;
  return `${formatNumber(numeric, { decimalPlaces })}%`;
}

/* ------------------------------------------------------------------ */
/* Dates (Asia/Shanghai)                                                */
/* ------------------------------------------------------------------ */

export interface ShanghaiParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

const DATE_ONLY = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const LOCAL_DATE_TIME = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

/** The instant of a Shanghai wall-clock time. */
export function shanghaiWallTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - SHANGHAI_OFFSET_MS);
}

export function shanghaiParts(date: Date): ShanghaiParts {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Parse a stored/entered date value. ISO strings with a zone are instants;
 * strings without a zone ("2026-09-17", "2026-09-17 08:30") are Shanghai wall time.
 */
export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly) return shanghaiWallTime(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]));
  const local = LOCAL_DATE_TIME.exec(text);
  if (local) {
    return shanghaiWallTime(
      Number(local[1]),
      Number(local[2]),
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6] ?? 0),
    );
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function displayPrecisionOf(widget: FieldWidget | undefined, fallback: DisplayPrecision = "DATETIME_SECOND"): DisplayPrecision {
  return widget?.displayPrecision ?? widget?.dateTimeDisplayType ?? fallback;
}

/** "YYYY-MM-DD" / "YYYY-MM-DD HH:mm" / "YYYY-MM-DD HH:mm:ss" in Asia/Shanghai. */
export function formatDateTime(value: unknown, precision: DisplayPrecision = "DATETIME_SECOND"): string {
  if (Array.isArray(value)) {
    const [from, to] = value;
    if (isEmptyValue(from) && isEmptyValue(to)) return EMPTY_TEXT;
    return `${formatDateTime(from, precision)} ~ ${formatDateTime(to, precision)}`;
  }
  if (isEmptyValue(value)) return EMPTY_TEXT;
  if (typeof value === "string" && precision === "DATE") {
    const dateOnly = DATE_ONLY.exec(value.trim());
    if (dateOnly) return `${dateOnly[1]}-${pad2(dateOnly[2])}-${pad2(dateOnly[3])}`;
  }
  const date = parseDateValue(value);
  if (!date) return typeof value === "string" ? value : EMPTY_TEXT;
  const parts = shanghaiParts(date);
  const ymd = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  if (precision === "DATE") return ymd;
  const hm = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  if (precision === "DATETIME_MINUTE") return `${ymd} ${hm}`;
  return `${ymd} ${hm}:${pad2(parts.second)}`;
}

/** Today in Shanghai as "YYYY-MM-DD". */
export function shanghaiToday(now: Date = new Date()): string {
  const parts = shanghaiParts(now);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Calendar arithmetic on "YYYY-MM-DD" strings. */
export function shiftYmd(ymd: string, days: number): string {
  const match = DATE_ONLY.exec(ymd.trim());
  if (!match) return ymd;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Stored value → `<input type="date">` value ("YYYY-MM-DD"). */
export function toDateInputValue(value: unknown): string {
  if (isEmptyValue(value)) return "";
  if (typeof value === "string") {
    const dateOnly = DATE_ONLY.exec(value.trim());
    if (dateOnly) return `${dateOnly[1]}-${pad2(dateOnly[2])}-${pad2(dateOnly[3])}`;
  }
  const date = parseDateValue(value);
  return date ? formatDateTime(date, "DATE") : "";
}

/** Stored value → `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm[:ss]"), Shanghai wall time. */
export function toDateTimeInputValue(value: unknown, withSeconds = false): string {
  const date = parseDateValue(value);
  if (!date) return "";
  const parts = shanghaiParts(date);
  const base = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
  return withSeconds ? `${base}:${pad2(parts.second)}` : base;
}

/** `<input type="datetime-local">` value (Shanghai wall time) → ISO instant, or null when empty/invalid. */
export function fromDateTimeInputValue(text: string | null | undefined): string | null {
  if (!text || !text.trim()) return null;
  const date = parseDateValue(text.replace("T", " "));
  return date ? date.toISOString() : null;
}

/** Shanghai wall time "YYYY-MM-DD HH:mm:ss" → ISO instant. */
export function shanghaiDateTimeToIso(ymd: string, time = "00:00:00"): string | null {
  const date = parseDateValue(`${ymd} ${time}`);
  return date ? date.toISOString() : null;
}

/* ------------------------------------------------------------------ */
/* Options                                                              */
/* ------------------------------------------------------------------ */

export function findOption(options: readonly SelectOption[] | undefined, value: unknown): SelectOption | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return options?.find((option) => String(option.value) === String(value));
}

function scalarOptionLabel(options: readonly SelectOption[] | undefined, value: unknown): string {
  if (typeof value === "boolean" && !findOption(options, value)) return value ? "是" : "否";
  const option = findOption(options, value);
  if (option) return option.label;
  if (isRefValue(value)) return value.name || value.code || value.id;
  return String(value);
}

/** Label(s) of a single/multi select value; unknown values fall back to their text. */
export function formatOptionValue(options: readonly SelectOption[] | undefined, value: unknown, separator = "、"): string {
  if (isEmptyValue(value)) return EMPTY_TEXT;
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isEmptyValue(item))
      .map((item) => scalarOptionLabel(options, item))
      .join(separator);
  }
  return scalarOptionLabel(options, value);
}

export type OptionTone = "default" | "processing" | "success" | "warning" | "error";

const TONE_RULES: readonly [RegExp, OptionTone][] = [
  [/逾期|取消|拒绝|作废|缺料|加急|失败|停用|异常|不合格/, "error"],
  [/待审批|未审批|待确认|审批中|部分/, "warning"],
  [/执行中|进行中|处理中|生产中|已下发/, "processing"],
  [/已结束|已完成|已审批|已通过|已确认|全部|已入库|已收货|已发货|启用|足料|成功|合格|已分配/, "success"],
];

/** Status tone derived from the option label (used when an option has no explicit color). */
export function optionTone(label: string): OptionTone {
  for (const [pattern, tone] of TONE_RULES) {
    if (pattern.test(label)) return tone;
  }
  return "default";
}

/* ------------------------------------------------------------------ */
/* Relations, people, files                                             */
/* ------------------------------------------------------------------ */

/** RefValue / RefValue[] / plain text → display names. */
export function formatRefValue(value: unknown, separator = "、"): string {
  if (isEmptyValue(value)) return EMPTY_TEXT;
  if (Array.isArray(value)) {
    const names = value
      .filter((item) => !isEmptyValue(item))
      .map((item) => (isRefValue(item) ? item.name || item.code || item.id : String(item)));
    return names.length ? names.join(separator) : EMPTY_TEXT;
  }
  if (isRefValue(value)) return value.name || value.code || value.id;
  if (typeof value === "object") return EMPTY_TEXT;
  return String(value);
}

/** "名称 | 编码". */
export function refOptionLabel(ref: Pick<RefValue, "name" | "code"> | null | undefined): string {
  if (!ref) return "";
  return ref.code ? `${ref.name} | ${ref.code}` : ref.name;
}

export function fileList(value: unknown): FileValue[] {
  if (!Array.isArray(value)) return isFileValue(value) ? [value] : [];
  return value.filter(isFileValue);
}

/** "2 张图片" / "3 个附件". */
export function formatFileCount(value: unknown, kind: "IMAGE" | "ATTACHMENT"): string {
  const count = fileList(value).length;
  if (!count) return EMPTY_TEXT;
  return kind === "IMAGE" ? `${count} 张图片` : `${count} 个附件`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/* Field values                                                         */
/* ------------------------------------------------------------------ */

export type FormattableField = Pick<FieldDef, "type" | "widget" | "options">;

export interface FormatFieldOptions {
  /** Export / print text: empty cells are "", files list their names. */
  plain?: boolean;
}

function formatUnknown(value: unknown, plain: boolean): string {
  if (isEmptyValue(value)) return plain ? "" : EMPTY_TEXT;
  if (typeof value === "string") return value;
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value instanceof Date) return formatDateTime(value);
  if (Array.isArray(value)) {
    if (value.every(isFileValue)) return plain ? value.map((file) => file.name).join("、") : formatFileCount(value, "ATTACHMENT");
    return value.map((item) => formatUnknown(item, plain)).filter(Boolean).join("、");
  }
  if (isRefValue(value)) return formatRefValue(value);
  if (isFileValue(value)) return value.name;
  return plain ? "" : EMPTY_TEXT;
}

/** Display text of one field value (lists, tooltips, export cells, print templates, mobile cards). */
export function formatFieldValue(field: FormattableField, value: unknown, options: FormatFieldOptions = {}): string {
  const plain = options.plain === true;
  const empty = plain ? "" : EMPTY_TEXT;
  if (isEmptyValue(value)) return empty;
  const widget = field.widget ?? {};
  switch (field.type) {
    case "NUMBER": {
      const text = formatNumber(value, numberOptionsOf(widget));
      return text === EMPTY_TEXT ? formatUnknown(value, plain) : text;
    }
    case "DATETIME":
      return formatDateTime(value, displayPrecisionOf(widget));
    case "SINGLE_SELECT":
    case "MULTI_SELECT":
      return formatOptionValue(field.options, value);
    case "RELATION_OBJECT":
    case "RELATION_ATTRIBUTE":
      if (isRefValue(value) || (Array.isArray(value) && value.some(isRefValue))) return formatRefValue(value);
      return formatUnknown(value, plain);
    case "IMAGE":
    case "ATTACHMENT":
      if (plain) return fileList(value).map((file) => file.name).join("、");
      return formatFileCount(value, field.type);
    case "RELATION_REFERENCE":
      // 关联引用 values take the type of the referenced field (widget.fieldType).
      if (widget.fieldType && widget.fieldType !== "RELATION_REFERENCE") {
        return formatFieldValue({ ...field, type: widget.fieldType }, value, options);
      }
      return formatUnknown(value, plain);
    case "TEXT":
    case "HYPERLINK":
    default:
      return formatUnknown(value, plain);
  }
}
