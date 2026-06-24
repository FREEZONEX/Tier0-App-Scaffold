"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useI18n } from "@/hmi/i18n/context";

interface MimicTitleProps {
  name: string;
  onRename: (name: string) => void;
}

const iconBtn =
  "grid size-7 place-items-center rounded-sm border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground";

/**
 * 顶栏图纸标题：显示 meta.name，点铅笔内联改名。改名走 history（顶栏即时更新），
 * 点「保存」才落库——与编辑节点一致。多图切换/新建/删除当前不暴露（后端能力保留）。
 */
export function MimicTitle({ name, onRename }: MimicTitleProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => {
    setDraft(name);
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const submit = () => {
    const v = draft.trim();
    if (v && v !== name) onRename(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" data-testid="mimic-title">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") cancel();
          }}
          aria-label={t("图纸名称")}
          className="h-7 w-56 rounded-sm border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-focus-accent"
        />
        <button type="button" onClick={submit} aria-label={t("确认")} className={iconBtn}>
          <Check className="size-3.5" />
        </button>
        <button type="button" onClick={cancel} aria-label={t("取消")} className={iconBtn}>
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="mimic-title">
      <span title={name} className="truncate text-sm font-semibold text-foreground">{name}</span>
      <button type="button" onClick={start} aria-label={t("重命名")} title={t("重命名")} className={iconBtn}>
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
