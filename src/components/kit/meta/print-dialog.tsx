"use client";

import { useKitApi, type KitApi } from "@/components/kit/provider";


/**
 * PrintDialog — 选择打印模板 (151 / 152): template buttons (selected = blue),
 * 「请先配置打印模板」 when none, 取消 / 确认 → 「打印渲染中，请稍候」 →
 * POST /api/system/print/render → 打印预览 (CARD: 标题、二维码、字段网格、明细表;
 * LABEL: 标签 + 二维码) → 打印 = window.print(), printing only the preview pages.
 *
 * Row 打印 passes one id; 批量打印 passes up to 20 ids (one page per record).
 */
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AsyncView } from "@/components/data/async-view";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/kit/ui/feedback";
import { errorMessage } from "@/lib/component-kit/api-client";
import { useRequest } from "@/lib/hooks";
import type { PrintPage, PrintTemplate } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { resourcePath as apiUrl } from "@/lib/component-kit/api-client";

export interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectCode: string;
  /** Records to print (≤ 20). */
  ids: string[];
}

const PRINT_CSS = `
@media print {
  body > *:not([data-tier0-print-root]) { display: none !important; }
  [data-tier0-print-root] { display: block !important; position: static !important; }
  [data-tier0-print-page] { break-after: page; page-break-after: always; }
  [data-tier0-print-page]:last-child { break-after: auto; page-break-after: auto; }
  @page { size: A4; margin: 12mm; }
}
`;

function useQrCodes(values: (string | null)[]): Record<string, string> {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const key = values.filter(Boolean).join("\n");
  useEffect(() => {
    let cancelled = false;
    const pending = values.filter((value): value is string => Boolean(value));
    if (pending.length === 0) return;
    void import("qrcode").then(async (module) => {
      const entries = await Promise.all(
        pending.map(async (value) => [value, await module.toDataURL(value, { margin: 1, width: 160 })] as const),
      );
      if (!cancelled) setCodes(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return codes;
}

/** 批量打印上限. */
export const PRINT_LIMIT = 20;

/** Build a localized limit message for the configured object. */
export function printLimitMessage(objectName: string): string {
  return `最多只能选择${PRINT_LIMIT}条${objectName}！`;
}

function CardPage({ page, qr }: { page: PrintPage; qr?: string }) {
  return (
    <article data-tier0-print-page="" className="mx-auto w-full max-w-[760px] bg-white p-6 text-[13px] text-black">
      <header className="relative mb-4 flex min-h-12 items-center justify-center border-b-2 border-black pb-3">
        <h2 className="text-center text-xl font-semibold tracking-wide">{page.title}</h2>
        {qr ? <img src={qr} alt="二维码" className="absolute top-0 right-0 size-16" /> : null}
      </header>
      {page.header.length ? (
        <table className="w-full table-fixed border-collapse [&_td]:border [&_td]:border-black [&_td]:px-2 [&_td]:py-1.5">
          <colgroup>
            <col className="w-28" />
            <col />
            <col className="w-28" />
            <col />
          </colgroup>
          <tbody>
            {Array.from({ length: Math.ceil(page.header.length / 2) }, (_, rowIndex) => page.header.slice(rowIndex * 2, rowIndex * 2 + 2)).map(
              (pair, rowIndex) => (
                <tr key={rowIndex}>
                  {pair.map((item) => (
                    <FieldCells key={item.label} label={item.label} value={item.value} />
                  ))}
                  {pair.length === 1 ? <td colSpan={2} /> : null}
                </tr>
              ),
            )}
          </tbody>
        </table>
      ) : null}
      {page.detail && page.detail.columns.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse [&_td]:border [&_td]:border-black [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-black [&_th]:bg-[#f2f2f2] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold">
            <thead>
              <tr>
                <th className="w-12 text-center">序号</th>
                {page.detail.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.detail.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="text-center">{rowIndex + 1}</td>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell || ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

function FieldCells({ label, value }: { label: string; value: string }) {
  return (
    <>
      <td className="bg-[#f7f7f7] font-medium break-words">{label}</td>
      <td className="break-all">{value || ""}</td>
    </>
  );
}

function LabelPage({ page, qr }: { page: PrintPage; qr?: string }) {
  return (
    <article
      data-tier0-print-page=""
      className="mx-auto flex w-full max-w-[380px] items-stretch gap-3 rounded border border-black bg-white p-3 text-[12px] text-black"
    >
      <div className="min-w-0 flex-1">
        <h2 className="mb-2 border-b border-black pb-1 text-base font-semibold">{page.title}</h2>
        <dl className="grid gap-1">
          {page.header.map((item) => (
            <div key={item.label} className="flex min-w-0 gap-1">
              <dt className="shrink-0 font-medium">{item.label}：</dt>
              <dd className="min-w-0 break-all">{item.value || ""}</dd>
            </div>
          ))}
        </dl>
      </div>
      {qr ? <img src={qr} alt="二维码" className="size-24 shrink-0 self-center" /> : null}
    </article>
  );
}

function PrintPages({ pages, layout }: { pages: PrintPage[]; layout: PrintTemplate["layout"] }) {
  const codes = useQrCodes(pages.map((page) => page.qrValue));
  return (
    <div className="flex flex-col gap-6">
      {pages.map((page, index) =>
        layout === "LABEL" ? (
          <LabelPage key={index} page={page} qr={page.qrValue ? codes[page.qrValue] : undefined} />
        ) : (
          <CardPage key={index} page={page} qr={page.qrValue ? codes[page.qrValue] : undefined} />
        ),
      )}
    </div>
  );
}

/**
 * 模板列表：网络层失败（浏览器抛 TypeError「Failed to fetch」，例如开发服务器正在重载）时重试一次，
 * 避免第一次打开打印弹窗偶发报错还要用户自己重试。
 */
async function loadTemplates(api: KitApi, objectCode: string, signal: AbortSignal): Promise<PrintTemplate[]> {
  const url = apiUrl(`/api/system/print-templates`) + `?objectCode=${encodeURIComponent(objectCode)}`;
  try {
    return await api.getJson<PrintTemplate[]>(url, { signal });
  } catch (error) {
    if (signal.aborted || !(error instanceof TypeError)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (signal.aborted) throw error;
    return api.getJson<PrintTemplate[]>(url, { signal });
  }
}

interface PreviewState {
  template: PrintTemplate;
  pages: PrintPage[];
}

function PrintBody({
  objectCode,
  ids,
  preview,
  onPreview,
  onClose,
}: {
  objectCode: string;
  ids: string[];
  preview: PreviewState | null;
  onPreview: (preview: PreviewState | null) => void;
  onClose: () => void;
}) {
  const api = useKitApi();
  const templates = useRequest(`print-templates:${objectCode}`, (signal) => loadTemplates(api, objectCode, signal));
  const [selected, setSelected] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const available = useMemo(() => (templates.data ?? []).filter((template) => template.enabled !== false), [templates.data]);
  const template = available.find((item) => item.code === selected) ?? null;

  const render = async () => {
    if (!template) {
      toast.warning("请选择打印模板");
      return;
    }
    setRendering(true);
    try {
      const result = await api.sendJson<{ pages: PrintPage[] }>(apiUrl(`/api/system/print/render`), {
        method: "POST",
        body: { templateCode: template.code, objectCode, ids },
      });
      if (!result.pages.length) {
        toast.warning("没有可打印的数据");
        return;
      }
      onPreview({ template, pages: result.pages });
    } catch (error) {
      toast.error(errorMessage(error, "打印渲染失败"));
    } finally {
      setRendering(false);
    }
  };

  if (preview) {
    const { pages, template: previewTemplate } = preview;
    return (
      <div className="flex min-h-full min-w-0 flex-col gap-4">
        <style>{PRINT_CSS}</style>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" icon={<ArrowLeft />} onClick={() => onPreview(null)}>
            重新选择模板
          </Button>
          <span className="text-sm text-text-secondary">
            {previewTemplate.name} · 共 {pages.length} 页
          </span>
          <Button variant="primary" icon={<Printer />} onClick={() => window.print()}>
            打印
          </Button>
        </div>
        <div className="min-w-0 flex-1 overflow-auto rounded-lg bg-[#eef0f3] p-4 sm:p-6">
          <PrintPages pages={pages} layout={previewTemplate.layout} />
        </div>
        {typeof document !== "undefined"
          ? createPortal(
              <div data-tier0-print-root="" className="hidden">
                <PrintPages pages={pages} layout={previewTemplate.layout} />
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AsyncView
        result={templates}
        isEmpty={(list) => list.filter((item) => item.enabled !== false).length === 0}
        empty={<Empty description="请先配置打印模板" />}
      >
        {() => (
          <div className="flex min-h-32 flex-wrap content-start gap-3" role="radiogroup" aria-label="打印模板">
            {available.map((item) => (
              <Button
                key={item.code}
                role="radio"
                aria-checked={selected === item.code}
                variant={selected === item.code ? "primary" : "outline"}
                title={item.name}
                className={cn("max-w-full", selected === item.code && "shadow-none")}
                onClick={() => setSelected(item.code)}
              >
                <span className="truncate">{item.name}</span>
              </Button>
            ))}
          </div>
        )}
      </AsyncView>
      <p className="text-xs text-text-tertiary">已选择 {ids.length} 条数据，每条数据打印一页</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={rendering}>
          取消
        </Button>
        <Button variant="primary" loading={rendering} disabled={!template} onClick={() => void render()}>
          {rendering ? "打印渲染中，请稍候" : "确认"}
        </Button>
      </div>
    </div>
  );
}

export function PrintDialog({ open, onOpenChange, objectCode, ids }: PrintDialogProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPreview(null);
        onOpenChange(next);
      }}
      title={preview ? "打印预览" : "选择打印模板"}
      size={preview ? "full" : "md"}
      contentClassName="flex flex-col"
    >
      {open ? (
        <PrintBody
          objectCode={objectCode}
          ids={ids}
          preview={preview}
          onPreview={setPreview}
          onClose={() => {
            setPreview(null);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}
