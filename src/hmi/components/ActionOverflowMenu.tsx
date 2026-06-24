"use client";

import { useEffect } from "react";
import { useT } from "@/hmi/i18n/context";
import type { DeviceAction } from "@/hmi/schema/schema";

/**
 * ⋯ 溢出动作菜单（React 浮层，非 Canvas 绘制）：锚定按钮屏幕坐标，列出未直达的动作。
 * 点选执行；Esc / 点外部关闭。遮罩 fixed inset-0 在菜单存活期拦截全部画布指针/滚轮事件——
 * 平移缩放到不了 canvas、点画布即先关菜单再生效，因此菜单与按钮不会错位，上层无需监听 viewport。
 */
export function ActionOverflowMenu({
  actions,
  startIndex,
  anchorX,
  anchorY,
  onPick,
  onClose,
}: {
  /** 溢出部分动作（原列表 slice(startIndex)）。 */
  actions: readonly DeviceAction[];
  /** 溢出首项在完整动作列表中的下标（回传执行用）。 */
  startIndex: number;
  anchorX: number;
  anchorY: number;
  onPick: (actionIndex: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 越界钳位：贴近屏幕右/下边缘时往回收，免被视口裁切（按行高 ~30px + 边距估算尺寸即可）。
  // "use client" 且仅交互后渲染，window 可安全直读。
  const left = Math.min(anchorX, window.innerWidth - 150);
  const top = Math.min(anchorY, window.innerHeight - (actions.length * 30 + 16));

  return (
    <div className="fixed inset-0 z-40" onClick={onClose} data-testid="action-overflow-overlay">
      <div
        role="menu"
        aria-label={t("更多操作")}
        className="absolute z-50 min-w-28 rounded-md border border-border bg-card py-1 shadow-lg"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
        data-testid="action-overflow-menu"
      >
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => onPick(startIndex + i)}
            title={a.label}
            data-testid={`overflow-item-${i}`}
            className="block w-full truncate px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-inset"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
