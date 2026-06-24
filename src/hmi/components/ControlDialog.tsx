"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/hmi/i18n/context";

/**
 * 设备动作二次确认弹窗（预览模式点击 confirm 动作触发）：
 * 高危动作误触保护，确认按钮文案带动作语义而非笼统 OK。
 * 不用原生 confirm（阻塞渲染循环且不可定制）。Esc / 点遮罩取消。
 */
export interface ControlDialogRequest {
  kind: "confirm";
  title: string;
  message: string;
  confirmLabel: string;
}

export function ControlDialog({
  request,
  onConfirm,
  onCancel,
}: {
  request: ControlDialogRequest;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      data-testid="control-dialog-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        className="w-72 rounded-md border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="control-dialog"
      >
        <p className="mb-1 text-sm font-semibold text-foreground">{request.title}</p>
        <p className="mb-3 text-xs text-muted-foreground">{request.message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            data-testid="control-dialog-cancel"
          >
            {t("取消")}
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-foreground px-2.5 py-1 text-xs font-medium text-background"
            data-testid="control-dialog-confirm"
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
