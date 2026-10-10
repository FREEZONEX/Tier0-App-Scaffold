"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ExcelLogModal — 导入日志 / 导出日志:
 * full-screen dialog, 导入时间 / 导出时间 range (default last 30 days) + 查询,
 * table 时间 / 用户 / 结果 / 详情 / 操作 (下载), pagination, 返回.
 */
import { Download, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AsyncView } from "@/components/data/async-view";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { TextButton } from "@/components/kit/ui/buttons";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { DateRangePicker } from "@/components/kit/ui/date-picker";
import { Pagination } from "@/components/kit/ui/pagination";
import { errorMessage } from "@/lib/component-kit/api-client";
import { useRequest } from "@/lib/hooks";
import { downloadExcelLog, fetchExcelLogs } from "@/lib/component-kit/export";
import { formatDateTime, shanghaiToday, shiftYmd } from "@/lib/component-kit/format";
import type { ExcelLog } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

export interface ExcelLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "IMPORT" | "EXPORT";
  objectCode: string;
  objectName?: string;
}

const RESULT_LABEL: Record<ExcelLog["result"], string> = {
  SUCCESS: "成功",
  PARTIAL: "部分成功",
  FAILED: "失败",
};

const RESULT_DOT: Record<ExcelLog["result"], string> = {
  SUCCESS: "bg-success",
  PARTIAL: "bg-warning",
  FAILED: "bg-danger",
};

function LogBody({ type, objectCode, onClose }: { type: "IMPORT" | "EXPORT"; objectCode: string; onClose: () => void }) {
  const api = useKitApi();
  const verb = type === "IMPORT" ? "导入" : "导出";
  const today = shanghaiToday();
  const [draftRange, setDraftRange] = useState<[string, string] | null>([shiftYmd(today, -30), today]);
  const [range, setRange] = useState<[string, string] | null>(draftRange);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [token, setToken] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const logs = useRequest(
    `excel-logs:${type}:${objectCode}:${range?.[0] ?? ""}:${range?.[1] ?? ""}:${page}:${pageSize}:${token}`,
    (signal) =>
      fetchExcelLogs(api,
        { type, objectCode, from: range?.[0] ?? null, to: range?.[1] ?? null, current: page, pageSize },
        signal,
      ),
  );

  const download = async (log: ExcelLog) => {
    setDownloadingId(log.id);
    try {
      await downloadExcelLog(api, log.id);
    } catch (error) {
      toast.error(errorMessage(error, "下载失败"));
    } finally {
      setDownloadingId(null);
    }
  };

  const columns: DataGridColumn<ExcelLog>[] = [
    { key: "createdAt", title: `${verb}时间`, width: 200, render: (log) => formatDateTime(log.createdAt, "DATETIME_SECOND") },
    { key: "userName", title: `${verb}用户`, width: 160 },
    {
      key: "result",
      title: `${verb}结果`,
      width: 160,
      ellipsis: false,
      render: (log) => (
        <span className="inline-flex items-center gap-2">
          <span className={cn("size-1.5 rounded-full", RESULT_DOT[log.result] ?? "bg-text-tertiary")} aria-hidden="true" />
          {verb}
          {RESULT_LABEL[log.result] ?? log.result}
        </span>
      ),
    },
    { key: "detail", title: `${verb}详情`, width: 520 },
    {
      key: "__actions",
      title: "操作",
      width: 96,
      fixed: "right",
      ellipsis: false,
      render: (log) =>
        log.hasFile ? (
          <TextButton icon={<Download />} disabled={downloadingId === log.id} onClick={() => void download(log)}>
            下载
          </TextButton>
        ) : (
          <span className="text-text-tertiary">-</span>
        ),
    },
  ];

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="text-sm text-foreground">{verb}时间：</span>
        <DateRangePicker
          aria-label={`${verb}时间`}
          className="w-full sm:w-72"
          precision="DATE"
          valueFormat="date"
          value={draftRange}
          onChange={(next) => setDraftRange(next)}
        />
        <Button
          variant="primary"
          icon={<Search />}
          onClick={() => {
            setRange(draftRange);
            setPage(1);
            setToken((value) => value + 1);
          }}
        >
          查询
        </Button>
      </div>
      <AsyncView result={logs} isEmpty={() => false}>
        {(data) => (
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <DataGrid<ExcelLog>
              aria-label={`${verb}日志`}
              showIndex={false}
              columns={columns}
              rows={data.list}
              rowKey={(log) => log.id}
              rowHeight="MID"
              loading={logs.isLoading}
              maxHeight="calc(100dvh - 300px)"
            />
            <Pagination
              total={data.total}
              current={page}
              pageSize={pageSize}
              showQuickJumper={false}
              showTotal={(total) => `共${total}条结果`}
              onChange={(nextPage, nextSize) => {
                setPage(nextPage);
                setPageSize(nextSize);
              }}
            />
          </div>
        )}
      </AsyncView>
      <div className="mt-auto flex justify-center border-t border-border-secondary pt-3">
        <Button variant="outline" className="min-w-32" onClick={onClose}>
          返回
        </Button>
      </div>
    </div>
  );
}

export function ExcelLogModal({ open, onOpenChange, type, objectCode }: ExcelLogModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={type === "IMPORT" ? "导入日志" : "导出日志"}
      size="full"
      contentClassName="flex flex-col"
    >
      {open ? <LogBody key={type} type={type} objectCode={objectCode} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}
