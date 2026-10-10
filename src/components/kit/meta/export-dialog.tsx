"use client";

import { useKitApi } from "@/components/kit/provider";


/**
 * ExportDialog — 导出 (01 §5.6): 导出数据范围 = 全部（当前查询条件）/ 已勾选数据 /
 * 选中页面范围（起始页码 ~ 结束页码）, the 灵动 note「导出时不能操作系统,关闭弹框会导致
 * 导出失败」; POST /api/meta/export/$objectCode with the current query + visible
 * columns, then the xlsx downloads and an 导出日志 entry exists for re-download.
 */
import { Download, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { TextButton } from "@/components/kit/ui/buttons";
import { NumberInput } from "@/components/kit/ui/number-input";
import { RadioGroup } from "@/components/kit/ui/radio";
import { errorMessage } from "@/lib/component-kit/api-client";
import { exportObject } from "@/lib/component-kit/export";
import type { ExportRequest, QueryRequest } from "@/lib/component-kit/types";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectCode: string;
  objectName: string;
  /** Current list query (filters, sorts, view, group, scope, page size). */
  request: QueryRequest;
  /** Visible columns in display order. */
  fieldCodes: string[];
  /** Rows matching the current query. */
  total: number;
  /** Checked rows (offers 已勾选数据). */
  selectedIds?: string[];
  onOpenLog?: () => void;
}

type Range = "ALL" | "SELECTED" | "PAGES";

function ExportBody({
  objectCode,
  request,
  fieldCodes,
  total,
  selectedIds = [],
  onClose,
  onOpenLog,
}: Omit<ExportDialogProps, "open" | "onOpenChange" | "objectName"> & { onClose: () => void }) {
  const api = useKitApi();
  const pageSize = request.page?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [range, setRange] = useState<Range>(selectedIds.length ? "SELECTED" : "ALL");
  const [pageFrom, setPageFrom] = useState<number | null>(1);
  const [pageTo, setPageTo] = useState<number | null>(totalPages);
  const [exporting, setExporting] = useState(false);

  const submit = async () => {
    const body: ExportRequest = { ...request, fieldCodes };
    if (range === "SELECTED") {
      body.ids = selectedIds;
    } else if (range === "PAGES") {
      if (!pageFrom || !pageTo) {
        toast.error("请填写页面范围！");
        return;
      }
      if (pageFrom > pageTo) {
        toast.error("起始页码不能大于结束页码！");
        return;
      }
      body.pageFrom = pageFrom;
      body.pageTo = pageTo;
    }
    setExporting(true);
    try {
      const result = await exportObject(api, objectCode, body);
      toast.success(`导出成功，共 ${result.rowCount} 条数据`);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "导出失败"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md bg-[#fffbe6] px-3 py-2 text-sm text-[#ad6800]">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>提示：导出时不能操作系统,关闭弹框会导致导出失败</span>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-medium text-foreground">导出数据范围</span>
        <RadioGroup<string>
          aria-label="导出数据范围"
          direction="vertical"
          value={range}
          options={[
            { value: "ALL", label: `全部数据（按当前查询条件，共 ${total} 条）` },
            ...(selectedIds.length ? [{ value: "SELECTED", label: `已勾选数据（${selectedIds.length} 条）` }] : []),
            { value: "PAGES", label: "选中页面范围" },
          ]}
          onChange={(next) => setRange(next as Range)}
        />
        {range === "PAGES" ? (
          <div className="ml-6 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <NumberInput aria-label="起始页码" className="w-20" min={1} max={totalPages} precision={0} value={pageFrom} onChange={setPageFrom} />
            <span>-</span>
            <NumberInput aria-label="结束页码" className="w-20" min={1} max={totalPages} precision={0} value={pageTo} onChange={setPageTo} />
            <span>（请输入页码范围（例如：1-3））</span>
            <span className="w-full text-xs text-text-tertiary">每页 {pageSize} 条，共 {totalPages} 页</span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onOpenLog ? (
          <TextButton
            onClick={() => {
              onClose();
              onOpenLog();
            }}
          >
            查看导出日志
          </TextButton>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={exporting}>
            取消
          </Button>
          <Button variant="primary" icon={<Download />} loading={exporting} disabled={total === 0 && range !== "SELECTED"} onClick={() => void submit()}>
            {exporting ? "导出中…" : "导出"}
          </Button>
        </span>
      </div>
    </div>
  );
}

export function ExportDialog({ open, onOpenChange, objectName, ...rest }: ExportDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`导出${objectName}`}
      size="sm"
      closeOnOverlayClick={false}
    >
      {open ? <ExportBody {...rest} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}
