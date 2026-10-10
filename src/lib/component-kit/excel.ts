/**
 * Browser-side.xlsx helpers for 导入 / 导出 / 日志下载.
 *
 * - Writing uses `write-excel-file/browser`, reading `read-excel-file/browser`;
 *   both are loaded lazily so they never enter the SSR bundle.
 * - Import templates: sheet 1「导入数据」holds only the header row (required
 *   columns prefixed with * in red), so Excel row numbers match the server's
 *   row numbering (header = row 1). Sheet 2「导入说明」lists every column with
 *   its 必填 flag and excelTip. Uploads only read the first sheet.
 */
import { shanghaiParts } from "@/lib/component-kit/format";
import type { ExcelFilePayload } from "@/lib/component-kit/types";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export interface TemplateColumn {
  /** Header text (the field name the server maps back to a field). */
  name: string;
  required?: boolean;
  tip?: string | null;
}

export interface ParsedSheet {
  /** Header names with the leading * removed. */
  headers: string[];
  /** Data rows keyed by header name; empty rows are skipped. */
  rows: Record<string, unknown>[];
  /** Excel row number of each entry in `rows` (header is row 1). */
  rowNumbers: number[];
}

type WriteCell = {
  value?: string | number | boolean | Date;
  type?: StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;
  fontWeight?: "bold";
  textColor?: string;
  backgroundColor?: string;
  wrap?: boolean;
  format?: string;
} | null;

function timestampSuffix(now: Date = new Date()): string {
  const parts = shanghaiParts(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}`;
}

/** "单位导入模板.xlsx"-style file name with a safe.xlsx extension. */
export function ensureXlsxName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "导出数据";
  return /\.xlsx$/i.test(cleaned) ? cleaned : `${cleaned}.xlsx`;
}

export function exportFileName(objectName: string, now: Date = new Date()): string {
  return ensureXlsxName(`${objectName}导出_${timestampSuffix(now)}`);
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadWriter() {
  const module = await import("write-excel-file/browser");
  return module.default;
}

function columnWidth(texts: readonly string[]): number {
  const longest = texts.reduce((max, text) => {
    let width = 0;
    for (const char of text) width += (char.codePointAt(0) ?? 0) <= 0xff ? 1 : 2;
    return Math.max(max, width);
  }, 0);
  return Math.min(60, Math.max(10, longest + 2));
}

function headerCell(text: string, required = false): WriteCell {
  return {
    value: required ? `*${text}` : text,
    type: String,
    fontWeight: "bold",
    textColor: required ? "#E5484D" : "#1F1F1F",
    backgroundColor: "#EEF3FB",
  };
}

function textCell(value: unknown): WriteCell {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return { value, type: Number };
  return { value: String(value), type: String };
}

/** Write a simple single-sheet table and download it. */
export async function downloadTable(
  fileName: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  sheetName = "Sheet1",
): Promise<void> {
  const writeXlsxFile = await loadWriter();
  const data = [headers.map((header) => headerCell(header)), ...rows.map((row) => headers.map((_, index) => textCell(row[index])))];
  const columns = headers.map((header, index) =>
    ({ width: columnWidth([header, ...rows.slice(0, 200).map((row) => String(row[index] ?? ""))]) }),
  );
  // Cell objects follow the library's runtime shape; its generic typings are stricter than needed here.
  const blob = await writeXlsxFile(data as never, { sheet: sheetName, columns, stickyRowsCount: 1 }).toBlob();
  downloadBlob(blob, ensureXlsxName(fileName));
}

/** Download an export / log payload returned by the server. */
export async function downloadExcelPayload(payload: ExcelFilePayload): Promise<void> {
  await downloadTable(
    payload.fileName,
    payload.columns.map((column) => column.name),
    payload.rows,
    "导出数据",
  );
}

/** Build and download an import template (sheet 1 headers, sheet 2 instructions). */
export async function downloadImportTemplate(objectName: string, columns: readonly TemplateColumn[]): Promise<void> {
  const writeXlsxFile = await loadWriter();
  const dataSheet = [columns.map((column) => headerCell(column.name, column.required))];
  const guide = [
    [headerCell("字段名称"), headerCell("是否必填"), headerCell("填写说明")],
    ...columns.map((column) => [
      textCell(column.name),
      textCell(column.required ? "是" : "否"),
      textCell(column.tip ?? ""),
    ]),
    [null, null, null],
    [textCell("说明"), textCell("第一个Sheet为导入数据，从第 2 行开始填写；带 * 的列必填"), null],
  ];
  const blob = await writeXlsxFile(
    [
      {
        data: dataSheet,
        sheet: "导入数据",
        columns: columns.map((column) => ({ width: columnWidth([`*${column.name}`]) })),
        stickyRowsCount: 1,
      },
      {
        data: guide,
        sheet: "导入说明",
        columns: [
          { width: columnWidth(columns.map((column) => column.name).concat("字段名称")) },
          { width: 10 },
          { width: 60 },
        ],
      },
    ] as never,
  ).toBlob();
  downloadBlob(blob, ensureXlsxName(`${objectName}导入模板`));
}

function cellToImportValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    // Excel dates carry no zone: read-excel-file returns them as UTC wall time.
    const pad = (item: number) => String(item).padStart(2, "0");
    const ymd = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    const hasTime = value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds();
    return hasTime ? `${ymd} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}` : ymd;
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

export function normalizeHeader(text: unknown): string {
  return String(text ?? "")
    .replace(/^[\s*＊]+/, "")
    .replace(/\s+/g, "")
    .trim();
}

async function loadReader() {
  try {
    const module = await import("read-excel-file/browser");
    return module.readSheet;
  } catch {
    const module = await import("read-excel-file/universal");
    return module.readSheet;
  }
}

/** Read the first sheet of an uploaded.xlsx: row 1 is the header. */
export async function readFirstSheet(file: File | Blob): Promise<ParsedSheet> {
  const readSheet = await loadReader();
  const data = (await readSheet(file, 1)) as unknown[][];
  const [headerRow = [], ...body] = data;
  const headers = headerRow.map(normalizeHeader);
  const rows: Record<string, unknown>[] = [];
  const rowNumbers: number[] = [];
  body.forEach((cells, index) => {
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, column) => {
      if (!header) return;
      const value = cellToImportValue(cells[column]);
      if (value !== null) hasValue = true;
      record[header] = value;
    });
    if (hasValue) {
      rows.push(record);
      rowNumbers.push(index + 2);
    }
  });
  return { headers: headers.filter(Boolean), rows, rowNumbers };
}

export function isXlsxFile(file: File): boolean {
  return /\.xlsx$/i.test(file.name);
}
