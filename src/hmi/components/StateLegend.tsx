"use client";

import { useMemo, useState } from "react";
import { ListChecks, X } from "lucide-react";
import { SymbolCanvas } from "./SymbolCanvas";
import { useT } from "@/hmi/i18n/context";
import { LEGEND_ENTRIES, buildSwatch } from "./legend-entries";
import type { Palette } from "@/hmi/engine/theme";
import type { Registry } from "@/hmi/symbols/registry";

/** 状态图例：可折叠参考面板，用真实图元说明各设备状态的视觉语言（status-by-exception）。 */
export function StateLegend({ theme, registry }: { theme: Palette; registry: Registry }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const swatches = useMemo(
    () => LEGEND_ENTRIES.map((entry) => ({ entry, swatch: buildSwatch(entry, theme, registry) })),
    [theme, registry],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="legend-toggle"
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground hover:bg-surface-inset"
      >
        <ListChecks className="size-3.5" />
        {t("图例")}
      </button>
    );
  }

  return (
    <div
      data-testid="state-legend"
      className="w-72 rounded-sm border border-border bg-card/95 shadow-md backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <ListChecks className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{t("状态图例")}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => setOpen(false)} aria-label={t("收起图例")} className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2 p-3">
        {swatches.map(({ entry, swatch }) => (
          <li key={entry.key} className="flex items-center gap-2">
            <SymbolCanvas swatch={swatch} theme={theme} />
            <div className="min-w-0">
              <div title={t(entry.label)} className="truncate text-[11px] font-medium text-foreground">{t(entry.label)}</div>
              <div title={t(entry.desc)} className="truncate text-[10px] text-muted-foreground">{t(entry.desc)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
