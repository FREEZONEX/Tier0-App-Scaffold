"use client";

/**
 * 打印模板预览：the same page layouts as PrintDialog (CARD: 标题、二维码、字段网格、明细表;
 * LABEL: 标签 + 二维码) filled with placeholder values, updated live while editing.
 */
import { QrCode } from "lucide-react";
import type { PrintTemplateField } from "@/lib/component-kit/types";

export interface PrintTemplatePreviewProps {
  name: string;
  layout: "CARD" | "LABEL";
  showQrCode: boolean;
  headerFields: PrintTemplateField[];
  detailFields: PrintTemplateField[];
}

function QrPlaceholder({ size }: { size: "sm" | "md" }) {
  return (
    <span className={size === "sm" ? "flex size-14 shrink-0 items-center justify-center border border-dashed border-black/40 text-black/60" : "flex size-20 shrink-0 items-center justify-center self-center border border-dashed border-black/40 text-black/60"}>
      <QrCode className="size-8" aria-label="二维码" />
    </span>
  );
}

export function PrintTemplatePreview({ name, layout, showQrCode, headerFields, detailFields }: PrintTemplatePreviewProps) {
  const title = name.trim() || "模板名称";
  if (layout === "LABEL") {
    return (
      <article className="mx-auto flex w-full max-w-[380px] items-stretch gap-3 rounded border border-black bg-white p-3 text-[12px] text-black">
        <div className="min-w-0 flex-1">
          <h4 className="mb-2 border-b border-black pb-1 text-base font-semibold">{title}</h4>
          <dl className="grid gap-1">
            {headerFields.length ? (
              headerFields.map((field) => (
                <div key={field.code} className="flex min-w-0 gap-1">
                  <dt className="shrink-0 font-medium">{field.name}：</dt>
                  <dd className="min-w-0 text-black/50">xxxx</dd>
                </div>
              ))
            ) : (
              <p className="text-black/50">请选择表头字段</p>
            )}
          </dl>
        </div>
        {showQrCode ? <QrPlaceholder size="md" /> : null}
      </article>
    );
  }
  const pairs = Array.from({ length: Math.ceil(headerFields.length / 2) }, (_, index) => headerFields.slice(index * 2, index * 2 + 2));
  return (
    <article className="mx-auto w-full max-w-[760px] bg-white p-4 text-[12px] text-black shadow-sm ring-1 ring-black/5 sm:p-6">
      <header className="relative mb-4 flex min-h-12 items-center justify-center border-b-2 border-black pb-3">
        <h4 className="px-16 text-center text-lg font-semibold tracking-wide">{title}</h4>
        {showQrCode ? (
          <span className="absolute top-0 right-0">
            <QrPlaceholder size="sm" />
          </span>
        ) : null}
      </header>
      {pairs.length ? (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse [&_td]:border [&_td]:border-black [&_td]:px-2 [&_td]:py-1.5">
            <tbody>
              {pairs.map((pair, rowIndex) => (
                <tr key={rowIndex}>
                  {pair.map((field) => (
                    <FieldCells key={field.code} label={field.name} />
                  ))}
                  {pair.length === 1 ? <td colSpan={2} /> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-4 text-center text-black/50">请选择表头字段</p>
      )}
      {detailFields.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse [&_td]:border [&_td]:border-black [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-black [&_th]:bg-[#f2f2f2] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold">
            <thead>
              <tr>
                <th className="w-12 text-center">序号</th>
                {detailFields.map((field) => (
                  <th key={field.code}>{field.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2].map((row) => (
                <tr key={row}>
                  <td className="text-center">{row}</td>
                  {detailFields.map((field) => (
                    <td key={field.code} className="text-black/50">
                      xxxx
                    </td>
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

function FieldCells({ label }: { label: string }) {
  return (
    <>
      <td className="w-24 bg-[#f7f7f7] font-medium break-words">{label}</td>
      <td className="text-black/50">xxxx</td>
    </>
  );
}
