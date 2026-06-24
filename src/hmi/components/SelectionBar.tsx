"use client";

import { Trash2, X } from "lucide-react";
import { useT } from "@/hmi/i18n/context";

/**
 * 多选动作条（画布顶部居中，框选 ≥2 个时浮出）：明确显示已选数量并提供删除 / 取消，
 * 解决「选了一堆却不知道怎么批量删」的发现性问题（单选时由检视面板的删除按钮覆盖）。
 */
export function SelectionBar({
  count,
  onDelete,
  onClear,
}: {
  count: number;
  onDelete: () => void;
  onClear: () => void;
}) {
  const t = useT();
  return (
    <div
      data-testid="selection-bar"
      className="flex items-center gap-2 rounded-md border border-border bg-card/95 px-2 py-1 text-xs shadow-md backdrop-blur-sm"
    >
      <span className="px-1 font-medium text-foreground">{t("已选 {n} 个", { n: count })}</span>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1 rounded-sm border border-destructive/40 px-2 py-1 font-medium text-destructive hover:bg-destructive/10"
        data-testid="selection-delete"
      >
        <Trash2 className="size-3.5" />
        {t("删除")}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-1 rounded-sm px-2 py-1 text-muted-foreground hover:bg-surface-inset hover:text-foreground"
        data-testid="selection-clear"
      >
        <X className="size-3.5" />
        {t("取消")}
      </button>
    </div>
  );
}
