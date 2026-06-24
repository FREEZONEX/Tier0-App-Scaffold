"use client";

import { useState } from "react";
import { Hand, MousePointer2, Undo2, Redo2, Trash2, Save } from "lucide-react";
import { useT } from "@/hmi/i18n/context";

export type CanvasTool = "pan" | "select";

/**
 * 编辑态画布工具条（画布顶部居中）：选择/平移切换、撤销/重做、删除选中、保存画布。
 * 与左侧元件库、右侧检视面板错开，不抢位。
 */
export function EditToolbar({
  tool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedCount,
  onDelete,
  onSave,
}: {
  tool: CanvasTool;
  onToolChange: (t: CanvasTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedCount: number;
  onDelete: () => void;
  onSave: () => Promise<void>;
}) {
  const t = useT();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const save = async () => {
    setSaveState("saving");
    try {
      await onSave();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };
  const saveLabel = t(saveState === "saving" ? "保存中…" : saveState === "saved" ? "已保存" : saveState === "error" ? "保存失败" : "保存画布");

  const iconBtn = "flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-inset hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
  const toolBtn = (active: boolean) =>
    `flex items-center gap-1 rounded-sm px-2 py-1 text-xs ${active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface-inset hover:text-foreground"}`;

  return (
    <div
      data-testid="edit-toolbar"
      className="flex items-center gap-1 rounded-md border border-border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur-sm"
    >
      <div className="flex items-center gap-0.5" role="group" aria-label={t("画布工具")}>
        <button type="button" onClick={() => onToolChange("pan")} aria-pressed={tool === "pan"} className={toolBtn(tool === "pan")} title={t("平移工具：拖动画布平移")} data-testid="tool-pan">
          <Hand className="size-3.5" /> {t("平移")}
        </button>
        <button type="button" onClick={() => onToolChange("select")} aria-pressed={tool === "select"} className={toolBtn(tool === "select")} title={t("选择工具：拖节点移动、拖空白框选；悬停图元从连接点拖出连线")} data-testid="tool-select">
          <MousePointer2 className="size-3.5" /> {t("选择")}
        </button>
      </div>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <button type="button" onClick={onUndo} disabled={!canUndo} className={iconBtn} title={t("撤销（Ctrl+Z）")} aria-label={t("撤销")} data-testid="undo">
        <Undo2 className="size-4" />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} className={iconBtn} title={t("重做（Ctrl+Shift+Z）")} aria-label={t("重做")} data-testid="redo">
        <Redo2 className="size-4" />
      </button>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <button
        type="button"
        onClick={onDelete}
        disabled={selectedCount === 0}
        className={`${iconBtn} hover:text-destructive`}
        title={selectedCount > 0 ? t("删除选中的 {n} 个元件（Del）", { n: selectedCount }) : t("先选中元件再删除")}
        aria-label={t("删除选中")}
        data-testid="delete-selected"
      >
        <Trash2 className="size-4" />
        {selectedCount > 1 ? <span className="ml-0.5 text-[10px]">{selectedCount}</span> : null}
      </button>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <button
        type="button"
        onClick={save}
        disabled={saveState === "saving"}
        className={`flex items-center gap-1 rounded-sm px-2 py-1 text-xs disabled:opacity-50 ${saveState === "error" ? "text-destructive" : saveState === "saved" ? "text-state-running-fg" : "text-muted-foreground hover:bg-surface-inset hover:text-foreground"}`}
        title={t("保存画布（写回 schema，刷新保留）")}
        data-testid="save-canvas"
      >
        <Save className="size-3.5" />
        {saveLabel}
      </button>
    </div>
  );
}
