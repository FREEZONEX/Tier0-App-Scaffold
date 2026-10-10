"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ImportDialog — 导入数据 (140_prod_order_import.png):
 * * 导入模式 仅新增数据 / 更新和新增数据 (ⓘ 唯一键说明);
 * 1. 下载导入模板 (built from GET /api/meta/import-template/$objectCode);
 * 2. 上传完善好的表格 (drag & drop .xlsx ≤ 10MB, first sheet only);
 * 取消 / 确认 → POST /api/meta/import/$objectCode → result: 成功 / 失败条数,
 * 失败明细 (行号 + 原因), 下载结果文件, 查看导入日志.
 */
import { CircleCheck, CircleQuestionMark, Download, FileSpreadsheet, Trash2, TriangleAlert } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { FieldLabel } from "@/components/forms/field-label";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { RadioGroup } from "@/components/kit/ui/radio";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { errorMessage } from "@/lib/component-kit/api-client";
import { IMPORT_MAX_BYTES, downloadImportTemplate, isXlsxFile, readFirstSheet, type ParsedSheet } from "@/lib/component-kit/excel";
import { downloadExcelLog, fetchImportTemplate, importObject } from "@/lib/component-kit/export";
import { formatFileSize } from "@/lib/component-kit/format";
import type { ImportMode, ImportResult } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectCode: string;
  objectName: string;
  /** Called after the server processed the file (success or partial). */
  onImported?: (result: ImportResult) => void;
  /** 「查看导入日志」 link in the result view. */
  onOpenLog?: () => void;
}

const UPSERT_TIP = "更新已有数据时须填写有效的唯一标识；无法匹配的记录按新增处理。";

interface PickedFile {
  file: File;
  sheet: ParsedSheet;
}

function ImportBody({
  objectCode,
  objectName,
  onClose,
  onImported,
  onOpenLog,
}: {
  objectCode: string;
  objectName: string;
  onClose: () => void;
  onImported?: (result: ImportResult) => void;
  onOpenLog?: () => void;
}) {
  const api = useKitApi();
  const [mode, setMode] = useState<ImportMode>("ADD_ONLY");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    setTemplateLoading(true);
    try {
      const template = await fetchImportTemplate(api, objectCode);
      await downloadImportTemplate(
        template.objectName || objectName,
        template.columns.map((column) => ({
          name: column.name,
          required: column.required,
          tip: [column.tip, column.options?.length ? `可选值：${column.options.join(" / ")}` : null].filter(Boolean).join("；"),
        })),
      );
    } catch (error) {
      toast.error(errorMessage(error, "模板下载失败"));
    } finally {
      setTemplateLoading(false);
    }
  };

  const acceptFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isXlsxFile(file)) {
      toast.error("仅支持xlsx格式文件；");
      return;
    }
    if (file.size > IMPORT_MAX_BYTES) {
      toast.error("文件不能超过10MB!");
      return;
    }
    setParsing(true);
    try {
      const sheet = await readFirstSheet(file);
      if (sheet.rows.length === 0) {
        toast.error("导入失败！文件数据为空");
        return;
      }
      setPicked({ file, sheet });
    } catch (error) {
      toast.error(errorMessage(error, "文件解析失败，请确认是有效的 .xlsx 文件"));
    } finally {
      setParsing(false);
    }
  };

  const submit = async () => {
    if (!picked) return;
    setSubmitting(true);
    try {
      const response = await importObject(api, objectCode, { mode, fileName: picked.file.name, rows: picked.sheet.rows });
      // Map server row numbers (header = row 1, rows sent in order) back to Excel rows.
      const mapped: ImportResult = {
        ...response,
        rows: response.rows.map((row) => ({ ...row, row: picked.sheet.rowNumbers[row.row - 2] ?? row.row })),
      };
      setResult(mapped);
      onImported?.(mapped);
      if (mapped.failed === 0) toast.success(`导入成功，共 ${mapped.succeeded} 条`);
      else if (mapped.succeeded > 0) toast.warning(`部分导入成功：成功 ${mapped.succeeded} 条，失败 ${mapped.failed} 条`);
      else toast.error(`导入失败：${mapped.failed} 条数据未通过校验`);
    } catch (error) {
      toast.error(errorMessage(error, "导入失败"));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const failures = result.rows.filter((row) => !row.ok);
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg p-4",
            result.failed === 0 ? "bg-[#f6ffed]" : result.succeeded > 0 ? "bg-[#fffbe6]" : "bg-[#fff2f0]",
          )}
        >
          {result.failed === 0 ? (
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <TriangleAlert className={cn("mt-0.5 size-5 shrink-0", result.succeeded > 0 ? "text-warning" : "text-danger")} aria-hidden="true" />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-medium text-foreground">
              {result.failed === 0 ? "导入完成" : result.succeeded > 0 ? "部分导入成功" : "导入失败"}
            </p>
            <p className="mt-1 text-text-secondary">
              共 {result.total} 条，成功 <span className="font-medium text-success">{result.succeeded}</span> 条，失败{" "}
              <span className="font-medium text-danger">{result.failed}</span> 条
            </p>
          </div>
        </div>
        {failures.length > 0 ? (
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-foreground">失败明细</p>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border-secondary">
              <ul className="divide-y divide-border-secondary text-sm">
                {failures.map((row) => (
                  <li key={`${row.row}-${row.message}`} className="flex min-w-0 gap-3 px-3 py-2">
                    <span className="w-16 shrink-0 tabular-nums text-text-secondary">第 {row.row} 行</span>
                    <span className="min-w-0 flex-1 break-words text-danger">{row.message ?? "校验未通过"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-4">
            <TextButton
              icon={<Download />}
              disabled={downloading || !result.logId}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadExcelLog(api, result.logId);
                } catch (error) {
                  toast.error(errorMessage(error, "结果文件下载失败"));
                } finally {
                  setDownloading(false);
                }
              }}
            >
              下载结果文件
            </TextButton>
            {onOpenLog ? (
              <TextButton
                onClick={() => {
                  onClose();
                  onOpenLog();
                }}
              >
                查看导入日志
              </TextButton>
            ) : null}
          </span>
          <span className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setPicked(null);
              }}
            >
              继续导入
            </Button>
            <Button variant="primary" onClick={onClose}>
              完成
            </Button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <FieldLabel required>导入模式</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <RadioGroup<string>
            aria-label="导入模式"
            value={mode}
            options={[
              { value: "ADD_ONLY", label: "仅新增数据" },
              { value: "UPSERT", label: "更新和新增数据" },
            ]}
            onChange={(next) => setMode(next as ImportMode)}
          />
          <Tooltip title={UPSERT_TIP}>
            <span className="inline-flex text-text-tertiary" aria-label={UPSERT_TIP} tabIndex={0}>
              <CircleQuestionMark className="size-4" />
            </span>
          </Tooltip>
        </div>
      </div>

      <section className="rounded-lg bg-[#f7f8fa] p-4">
        <h3 className="text-sm font-medium text-foreground">1. 下载导入模板</h3>
        <ul className="mt-2 space-y-1 text-sm text-text-secondary">
          <li>· 下载模板后，请按照导入说明填写完善表格中的内容</li>
          <li>· 当上传的表格有多个Sheet时，默认只导入第一个Sheet</li>
        </ul>
        <Button variant="outline" icon={<Download />} loading={templateLoading} className="mt-3" onClick={() => void downloadTemplate()}>
          下载模板表格
        </Button>
      </section>

      <section className="rounded-lg bg-[#f7f8fa] p-4">
        <h3 className="text-sm font-medium text-foreground">2. 上传完善好的表格</h3>
        {picked ? (
          <div className="mt-3 flex min-w-0 items-center gap-3 rounded-md border border-border-secondary bg-card px-3 py-3">
            <FileSpreadsheet className="size-8 shrink-0 text-[#1d7044]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground" title={picked.file.name}>
                {picked.file.name}
              </p>
              <p className="text-xs text-text-tertiary">
                {formatFileSize(picked.file.size)} · 共 {picked.sheet.rows.length} 行数据 · {picked.sheet.headers.length} 列
              </p>
            </div>
            <IconButton label="移除文件" icon={<Trash2 />} danger onClick={() => setPicked(null)} />
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="上传表格"
            data-file-dropzone=""
            className={cn(
              "mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-card px-4 py-8 text-center transition-colors",
              dragging ? "border-brand bg-brand-soft" : "border-[#d9dde4] hover:border-brand",
              parsing && "pointer-events-none opacity-60",
            )}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setDragging(false);
              void acceptFile(event.dataTransfer.files?.[0]);
            }}
          >
            <FileSpreadsheet className="size-10 text-[#1d7044]" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              {parsing ? "正在解析表格…" : (
                <>
                  将表格拖到此处或 <span className="text-brand">点击上传</span>
                </>
              )}
            </p>
            <p className="text-xs text-text-tertiary">支持的文件类型(.xlsx)，大小不超过10MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void acceptFile(file);
              }}
            />
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button variant="primary" disabled={!picked} loading={submitting} onClick={() => void submit()}>
          确认
        </Button>
      </div>
    </div>
  );
}

export function ImportDialog({ open, onOpenChange, objectCode, objectName, onImported, onOpenLog }: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="导入数据" size="md">
      {open ? (
        <ImportBody
          objectCode={objectCode}
          objectName={objectName}
          onClose={() => onOpenChange(false)}
          onImported={onImported}
          onOpenLog={onOpenLog}
        />
      ) : null}
    </Dialog>
  );
}
