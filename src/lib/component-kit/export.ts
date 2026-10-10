import { type KitApi } from "@/components/kit/provider";
/**
 * 导出 / 导入 / 日志下载 calls shared by MetaListPage, ExcelLogModal and pages
 * that trigger exports from custom toolbars.
 */

import {  } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";
import { downloadExcelPayload } from "@/lib/component-kit/excel";
import type {
  ExcelFilePayload,
  ExcelLog,
  ExportRequest,
  ImportMode,
  ImportResult,
  ImportTemplate,
  QueryResult,
} from "@/lib/component-kit/types";

export type ExportResponse = ExcelFilePayload & { logId: string };

/** POST /api/meta/export/$objectCode → download the xlsx; resolves with the row count. */
export async function exportObject(api: KitApi, objectCode: string, request: ExportRequest): Promise<{ logId: string; rowCount: number; fileName: string }> {
  const payload = await api.sendJson<ExportResponse>(apiUrl(`/api/meta/export/${objectCode}`), {
    method: "POST",
    body: request,
  });
  await downloadExcelPayload(payload);
  return { logId: payload.logId, rowCount: payload.rows.length, fileName: payload.fileName };
}

/** POST /api/meta/import/$objectCode with rows keyed by column (field) name. */
export async function importObject(api: KitApi,
  objectCode: string,
  body: { mode: ImportMode; fileName: string; rows: Record<string, unknown>[] },
): Promise<ImportResult> {
  return api.sendJson<ImportResult>(apiUrl(`/api/meta/import/${objectCode}`), { method: "POST", body });
}

/** GET /api/meta/import-template/$objectCode. */
export async function fetchImportTemplate(api: KitApi, objectCode: string, signal?: AbortSignal): Promise<ImportTemplate> {
  return api.getJson<ImportTemplate>(apiUrl(`/api/meta/import-template/${objectCode}`), { signal });
}

export interface ExcelLogQuery {
  type: "IMPORT" | "EXPORT";
  objectCode: string;
  from?: string | null;
  to?: string | null;
  current: number;
  pageSize: number;
}

export function excelLogQueryString(query: ExcelLogQuery): string {
  const params = new URLSearchParams({
    type: query.type,
    objectCode: query.objectCode,
    current: String(query.current),
    pageSize: String(query.pageSize),
  });
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return params.toString();
}

/** GET /api/meta/excel-logs. */
export async function fetchExcelLogs(api: KitApi, query: ExcelLogQuery, signal?: AbortSignal): Promise<QueryResult<ExcelLog>> {
  return api.getJson<QueryResult<ExcelLog>>(apiUrl(`/api/meta/excel-logs`) + `?${excelLogQueryString(query)}`, { signal });
}

/** GET /api/meta/excel-logs/$id → download the stored file. */
export async function downloadExcelLog(api: KitApi, id: string): Promise<void> {
  const payload = await api.getJson<ExcelFilePayload>(apiUrl(`/api/meta/excel-logs/${id}`));
  await downloadExcelPayload(payload);
}
