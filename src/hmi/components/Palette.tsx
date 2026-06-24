"use client";

import { useMemo, useState } from "react";
import { Shapes, X } from "lucide-react";
import { SymbolCanvas } from "./SymbolCanvas";
import { PaletteCard } from "./PaletteCard";
import { useT } from "@/hmi/i18n/context";
import { buildSwatch } from "./legend-entries";
import { makeState } from "@/hmi/symbols/preview";
import { ALL_CAPABILITIES, type SymbolCategory, type Capability } from "@/hmi/symbols/capabilities";
import type { Registry } from "@/hmi/symbols/registry";
import type { Palette as ThemePalette } from "@/hmi/engine/theme";

/** 悬浮卡估高，用于贴近视口底部时上移避免被裁。 */
const CARD_EST_HEIGHT = 240;

/** 元件库拖放载荷的 MIME（HmiCanvas onDrop 按此读取图元 type）。 */
export const PALETTE_MIME = "application/x-hmi-symbol";

/** 连线类拖放载荷的 MIME（值为 "pipe" 或 "lead"）。 */
export const PALETTE_LINE_MIME = "application/x-hmi-line";

const CATEGORIES: readonly SymbolCategory[] = ["设备", "执行器", "容器", "换热", "仪表", "端子"];

/** 连线卡片：实线管道 / 虚线引线。 */
const LINE_KINDS = [
  { kind: "pipe" as const, label: "实线管道", desc: "拖入画布画一段可调两端的线" },
  { kind: "lead" as const, label: "虚线引线", desc: "拖入画布画一段可调两端的线" },
];

/**
 * 元件库（仅编辑态）：左侧停靠栏，按品类单列列出所有已注册图元，真实 mini 图标 + 全名。
 * 拖拽到画布或点击即在画布新建该图元。停靠栏盖在画布左缘，遮住图例无妨（编辑态以放置为主）。
 */
export function Palette({
  registry,
  palette,
  onPlace,
  onPlaceLine,
}: {
  registry: Registry;
  palette: ThemePalette;
  onPlace: (type: string) => void;
  onPlaceLine: (kind: "pipe" | "lead") => void;
}) {
  const t = useT();
  // 默认收起：统一界面下保持画布干净，点「元件」展开即可拖入新图元。
  const [open, setOpen] = useState(false);
  // hover 详情卡：当前悬浮的图元契约 + 卡片视口定位（fixed）。
  const [hover, setHover] = useState<{ cap: Capability; left: number; top: number } | null>(null);

  // 默认（idle）态 mini 图标，按品类分组。主题/注册表变化才重算。
  const groups = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        items: ALL_CAPABILITIES.filter((c) => c.category === category).map((c) => ({
          cap: c,
          swatch: buildSwatch({ type: c.type, state: makeState(c, {}) }, palette, registry),
        })),
      })).filter((g) => g.items.length > 0),
    [palette, registry],
  );

  // 卡片定位：贴停靠栏右缘、与行顶对齐；接近视口底部时上移避免被裁。
  const showCard = (cap: Capability, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const top = Math.max(8, Math.min(r.top, window.innerHeight - CARD_EST_HEIGHT));
    setHover({ cap, left: r.right + 8, top });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="palette-toggle"
        className="absolute left-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-sm hover:bg-surface-inset hover:text-foreground"
      >
        <Shapes className="size-3.5" />
        {t("元件")}
      </button>
    );
  }

  return (
    <div
      data-testid="palette"
      className="absolute inset-y-0 left-0 z-30 flex h-full w-60 flex-col border-r border-border bg-card shadow-lg"
      onMouseLeave={() => setHover(null)}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Shapes className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{t("元件库")}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => setOpen(false)} aria-label={t("收起元件库")} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.map((g) => (
          <div key={g.category} className="mb-3 last:mb-0">
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t(g.category)}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.cap.type}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PALETTE_MIME, it.cap.type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onPlace(it.cap.type)}
                    onMouseEnter={(e) => showCard(it.cap, e.currentTarget)}
                    onFocus={(e) => showCard(it.cap, e.currentTarget)}
                    data-testid={`palette-item-${it.cap.type}`}
                    className="flex w-full cursor-grab items-center gap-2.5 rounded-sm border border-transparent px-1.5 py-1 text-left hover:border-border hover:bg-surface-inset active:cursor-grabbing"
                  >
                    <SymbolCanvas swatch={it.swatch} theme={palette} className="size-8 shrink-0" />
                    <span title={t(it.cap.label)} className="min-w-0 flex-1 truncate text-xs text-foreground">{t(it.cap.label)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {/* 连线类：不走 symbol/capability 系统，专属小节 */}
        <div className="mb-3">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("连线")}</div>
          <ul className="space-y-0.5">
            {LINE_KINDS.map((lk) => (
              <li key={lk.kind}>
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PALETTE_LINE_MIME, lk.kind);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onPlaceLine(lk.kind)}
                  title={t(lk.desc)}
                  data-testid={`palette-line-${lk.kind}`}
                  className="flex w-full cursor-grab items-center gap-2.5 rounded-sm border border-transparent px-1.5 py-1 text-left hover:border-border hover:bg-surface-inset active:cursor-grabbing"
                >
                  {/* 内联 SVG 线预览：实线 vs 虚线 */}
                  <span className="flex size-8 shrink-0 items-center justify-center">
                    <svg width="28" height="16" viewBox="0 0 28 16" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <line
                        x1="2" y1="8" x2="26" y2="8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray={lk.kind === "lead" ? "4 3" : undefined}
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{t(lk.label)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {hover ? <PaletteCard cap={hover.cap} registry={registry} palette={palette} style={{ left: hover.left, top: hover.top }} /> : null}
    </div>
  );
}
