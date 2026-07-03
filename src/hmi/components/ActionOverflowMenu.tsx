"use client";

import { useEffect, useState } from "react";
import { useT } from "@/hmi/i18n/context";
import type { DeviceAction } from "@/hmi/schema/schema";

/** 选中后成功反馈展示时长：够看清勾选、又不拖慢连续操作。 */
const PICKED_FLASH_MS = 450;

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
  // 选中项在原 actions 内的下标（非 startIndex 偏移后）：命中即高亮绿底+✓，短暂展示后自动关闭菜单。
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (pickedIndex === null) return;
    const timer = setTimeout(onClose, PICKED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [pickedIndex, onClose]);

  // 越界钳位：贴近屏幕右/下边缘时往回收，免被视口裁切（按行高 ~30px + 边距估算尺寸即可）。
  // "use client" 且仅交互后渲染，window 可安全直读。
  const left = Math.min(anchorX, window.innerWidth - 150);
  const top = Math.min(anchorY, window.innerHeight - (actions.length * 30 + 16));

  const handlePick = (i: number) => {
    if (pickedIndex !== null) return;
    onPick(startIndex + i);
    // 需二次确认的动作实际发送在确认弹窗之后——菜单这里没什么"成功"可展示，直接让位给弹窗。
    if (actions[i].confirm) { onClose(); return; }
    setPickedIndex(i);
  };

  return (
    <div className="fixed inset-0 z-40" onClick={onClose} data-testid="action-overflow-overlay">
      <div
        role="menu"
        aria-label={t("更多操作")}
        className="absolute z-50 min-w-28 rounded border bg-card py-1 shadow-lg"
        style={{ left, top, borderColor: "var(--hmi-stroke)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="action-overflow-menu"
      >
        {actions.map((a, i) => {
          const picked = i === pickedIndex;
          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={pickedIndex !== null}
              onClick={() => handlePick(i)}
              title={a.label}
              data-testid={`overflow-item-${i}`}
              className="flex w-full items-center justify-between gap-2 truncate px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-inset disabled:cursor-default"
              style={picked ? { backgroundColor: "var(--hmi-action-success)", color: "var(--hmi-text)" } : undefined}
            >
              <span className="truncate">{a.label}</span>
              {/* 固定占位：非选中态不可见但保留宽度，选中一瞬间不引起菜单项宽度跳动。 */}
              <span aria-hidden="true" className={picked ? undefined : "invisible"}>✓</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
