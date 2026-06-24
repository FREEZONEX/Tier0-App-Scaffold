"use client";

import { useEffect } from "react";
import { useT } from "@/hmi/i18n/context";

export interface ContextMenuItem {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

/**
 * 画布右键菜单（React 浮层，非 Canvas 绘制）：锚定鼠标屏幕坐标，列出可执行项。
 * 复用 ActionOverflowMenu 同款样式（border/bg-card/shadow，Esc / 点外 / 再右键关闭）。
 * 遮罩 fixed inset-0 在菜单存活期拦截画布指针/滚轮 → 菜单与锚点不会因平移缩放错位。
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: readonly ContextMenuItem[];
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 越界钳位：贴近屏幕右/下边缘往回收，免被视口裁切。
  const left = Math.min(x, window.innerWidth - 160);
  const top = Math.min(y, window.innerHeight - (items.length * 32 + 16));

  return (
    <div
      className="fixed inset-0 z-40"
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      data-testid="context-menu-overlay"
    >
      <div
        role="menu"
        aria-label={t("右键菜单")}
        className="absolute z-50 min-w-32 rounded-md border border-border bg-card py-1 shadow-lg"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
        data-testid="context-menu"
      >
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => { if (!it.disabled) { it.onClick(); onClose(); } }}
            className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-inset disabled:cursor-not-allowed disabled:opacity-40"
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
