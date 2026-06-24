"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { cellText, valueAtPath, type HistoryRow } from "@/hmi/data/uns-history";

const isGood = (q: string): boolean => q === "" || q.toLowerCase() === "good";

/** 单 topic 原始记录表：动态列（时间 + 负载各字段 + 质量），分页。全标量负载 → 单「值」列。 */
export function HistoryTable({
  rows,
  columns,
  page,
  pageCount,
  loading,
  onPageChange,
  formatTime,
  emptyLabel,
}: {
  rows: readonly HistoryRow[];
  columns: readonly string[];
  page: number;
  pageCount: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  formatTime: (ms: number) => string;
  emptyLabel: string;
}) {
  const t = useT();
  const scalarMode = columns.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="history-table">
      {/* 翻页时已有旧数据：半透明降不可点，让加载状态可感知 */}
      <div className={`min-h-0 flex-1 overflow-auto rounded-sm border border-border ${loading && rows.length > 0 ? "pointer-events-none opacity-50" : ""}`}>
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-surface-inset">
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium">{t("时间")}</th>
              {scalarMode ? (
                <th className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium">{t("值")}</th>
              ) : (
                columns.map((c) => (
                  <th key={c} className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium">
                    {c}
                  </th>
                ))
              )}
              <th className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium">{t("质量")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-surface-inset/40">
                <td className="whitespace-nowrap border-b border-border/60 px-2 py-1 font-mono text-muted-foreground">{formatTime(r.t)}</td>
                {scalarMode ? (
                  <td className="border-b border-border/60 px-2 py-1 font-mono text-foreground">{cellText(r.payload)}</td>
                ) : (
                  columns.map((c) => (
                    <td key={c} className="whitespace-nowrap border-b border-border/60 px-2 py-1 font-mono text-foreground">
                      {cellText(valueAtPath(r.payload, c))}
                    </td>
                  ))
                )}
                <td className={`whitespace-nowrap border-b border-border/60 px-2 py-1 ${isGood(r.quality) ? "text-muted-foreground" : "text-destructive"}`}>
                  {r.quality || "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{loading ? t("加载中…") : emptyLabel}</p>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>{t("第 {page} / {count} 页", { page, count: pageCount })}</span>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-sm border border-border p-1 hover:bg-surface-inset disabled:opacity-40"
          aria-label={t("上一页")}
          data-testid="history-table-prev"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="rounded-sm border border-border p-1 hover:bg-surface-inset disabled:opacity-40"
          aria-label={t("下一页")}
          data-testid="history-table-next"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
