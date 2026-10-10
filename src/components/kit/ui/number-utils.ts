/** Number parsing / formatting for NumberInput and table cells. */

export interface NumberFormatOptions {
  /** Maximum decimal places (rounds). */
  precision?: number;
  /** Pad decimals to `precision` (金额 12.50). Default false (计划数 10). */
  fixedDecimals?: boolean;
  /** Insert thousands separators (1,234,567.89). */
  thousandSeparator?: boolean;
}

/** Round half away from zero without binary float artefacts. */
export function roundTo(value: number, precision: number): number {
  if (!Number.isFinite(value) || precision < 0) return value;
  const sign = value < 0 ? -1 : 1;
  const shifted = Number(`${Math.abs(value)}e${precision}`);
  return sign * Number(`${Math.round(shifted)}e-${precision}`);
}

export function clampNumber(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
}

/** Plain decimal text without exponent notation. */
function plainText(value: number): string {
  if (Math.abs(value) < 1e21 && Math.abs(value) >= 1e-7) return String(value);
  if (value === 0) return "0";
  return value.toFixed(10).replace(/\.?0+$/, "");
}

export function formatNumber(
  value: number | null | undefined,
  { precision, fixedDecimals = false, thousandSeparator = false }: NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const rounded = precision === undefined ? value : roundTo(value, precision);
  let text =
    precision !== undefined && fixedDecimals ? rounded.toFixed(precision) : plainText(rounded);
  if (thousandSeparator) {
    const negative = text.startsWith("-");
    const body = negative ? text.slice(1) : text;
    const [integer, fraction] = body.split(".");
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    text = `${negative ? "-" : ""}${grouped}${fraction !== undefined ? `.${fraction}` : ""}`;
  }
  return text;
}

/** Parse user text ("1,234.5", " 12 ") → number, or null when empty/invalid. */
export function parseNumberText(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Whether `text` is an acceptable intermediate state while typing. */
export function isTypingNumber(text: string, { allowNegative = true, precision }: { allowNegative?: boolean; precision?: number } = {}): boolean {
  const cleaned = text.replace(/,/g, "");
  const pattern = allowNegative ? /^-?\d*(\.\d*)?$/ : /^\d*(\.\d*)?$/;
  if (!pattern.test(cleaned)) return false;
  if (precision === 0 && cleaned.includes(".")) return false;
  if (precision !== undefined && precision > 0) {
    const fraction = cleaned.split(".")[1];
    if (fraction !== undefined && fraction.length > precision) return false;
  }
  return true;
}
