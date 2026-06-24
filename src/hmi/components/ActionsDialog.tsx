"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { ActionsEditor } from "./ActionsEditor";
import type { MimicNode, DeviceAction, PublishMessage } from "@/hmi/schema/schema";

/**
 * 设备操作配置弹窗（仅编辑模式）：居中画布的模态卡片——半透明遮罩盖全屏，卡片居中。
 * 设备下方的按钮随输入实时预览（所见即所得）。Esc / 点遮罩关闭。
 * Inspector「操作」分节只留入口，配置本体都在这里（用户评审决策：详情=入口，配置=弹窗）。
 */
export function ActionsDialog({
  node,
  onSetActions,
  onTestSend,
  onClose,
}: {
  node: MimicNode;
  onSetActions: (actions: DeviceAction[] | undefined) => void;
  /** 试发送：admin 调试，不走确认弹窗，逐条直发。 */
  onTestSend: (items: readonly PublishMessage[]) => void;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose} data-testid="actions-dialog-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("设备操作配置")}
        className="flex max-h-[80vh] w-[440px] max-w-[92vw] flex-col rounded-md border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="actions-dialog"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={node.label ?? node.id}>
            {t("设备操作")} · {node.label ?? node.id}
          </span>
          <button type="button" onClick={onClose} aria-label={t("关闭")} className="text-muted-foreground hover:text-foreground" data-testid="actions-dialog-close">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            {t("给设备配操作按钮：点按钮发什么消息。改动即时生效，画布上设备下方实时预览。")}
          </p>
          <ActionsEditor node={node} onSetActions={onSetActions} onTestSend={onTestSend} />
        </div>
      </div>
    </div>
  );
}
