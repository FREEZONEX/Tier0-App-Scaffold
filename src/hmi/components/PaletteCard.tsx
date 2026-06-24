"use client";

import type { CSSProperties } from "react";
import { SymbolCanvas } from "./SymbolCanvas";
import { buildSwatch } from "./legend-entries";
import { useT } from "@/hmi/i18n/context";
import { previewVariants } from "@/hmi/symbols/preview";
import type { Capability } from "@/hmi/symbols/capabilities";
import type { Registry } from "@/hmi/symbols/registry";
import type { Palette as ThemePalette } from "@/hmi/engine/theme";

/**
 * 元件库悬浮详情卡：名称 + 品类 + 简介，代表性状态预览（previewVariants），可绑定字段列表。
 * 由 Palette 在 hover 时按位置渲染（fixed 定位，逸出停靠栏溢出裁剪）。
 */
export function PaletteCard({
  cap,
  registry,
  palette,
  style,
}: {
  cap: Capability;
  registry: Registry;
  palette: ThemePalette;
  style: CSSProperties;
}) {
  const t = useT();
  const variants = previewVariants(cap);
  return (
    <div
      className="fixed z-40 w-60 rounded-md border border-border bg-card p-3 shadow-xl"
      style={style}
      data-testid="palette-card"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">{t(cap.label)}</span>
        <span className="rounded-sm bg-surface-inset px-1 py-0.5 text-[10px] text-muted-foreground">{t(cap.category)}</span>
      </div>
      {cap.desc ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(cap.desc)}</p> : null}

      <div className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("状态")}</div>
      <div className="mt-1 flex flex-wrap gap-3">
        {variants.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <SymbolCanvas
              swatch={buildSwatch({ type: cap.type, state: v.state, props: v.props }, palette, registry)}
              theme={palette}
              className="size-10 shrink-0"
            />
            <span className="text-[9px] text-muted-foreground">{t(v.label)}</span>
          </div>
        ))}
      </div>

      {cap.states.length > 0 ? (
        <>
          <div className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("字段")}</div>
          <ul className="mt-1 space-y-0.5">
            {cap.states.map((s) => (
              <li key={s.key} className="flex items-baseline justify-between gap-2 text-[10px]">
                <code className="shrink-0 text-foreground">{s.key}</code>
                <span title={`${t(s.label)}${s.unit ? ` (${s.unit})` : ""}`} className="min-w-0 truncate text-right text-muted-foreground">
                  {t(s.label)}
                  {s.unit ? ` (${s.unit})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
