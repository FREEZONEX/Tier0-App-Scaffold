"use client";

/**
 * FullscreenModal — 全屏弹窗表单 (01 §6.2; 110 查看生产订单, 120 创建生产订单,
 * 133 未提交确认): fills the viewport, title top-left, × top-right, scrollable
 * body, centered footer buttons. `mode="view"` shows only 「返回」 unless a
 * footer is given. With `dirty`, closing asks 「有未提交的修改，确定关闭吗？」.
 */
import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Dialog } from "@/components/overlays/dialog";
import { Button } from "@/components/ui/button";
import type { FormMode } from "@/lib/component-kit/form-model";
import { DIRTY_GUARD_MESSAGE, DIRTY_GUARD_TITLE } from "@/lib/component-kit/use-dirty-guard";
import { cn } from "@/lib/utils";
import type { FormContainerContext } from "@/components/kit/meta/form-drawer";

export interface FullscreenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  mode?: FormMode;
  /** Unsaved changes → confirm before closing. */
  dirty?: boolean;
  /** Footer buttons (centered). Defaults to 「返回」 in view mode. */
  footer?: ReactNode | ((context: FormContainerContext) => ReactNode);
  children: ReactNode | ((context: FormContainerContext) => ReactNode);
  bodyClassName?: string;
}

export function FullscreenModal({
  open,
  onOpenChange,
  title,
  mode = "create",
  dirty = false,
  footer,
  children,
  bodyClassName,
}: FullscreenModalProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const forceClose = useCallback(() => {
    setConfirmOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const requestClose = useCallback(() => {
    if (confirmOpen) return;
    if (dirty && mode !== "view") {
      setConfirmOpen(true);
      return;
    }
    forceClose();
  }, [confirmOpen, dirty, forceClose, mode]);

  const context: FormContainerContext = { layout: "horizontal", requestClose, forceClose };
  const footerContent =
    typeof footer === "function"
      ? footer(context)
      : footer ??
        (mode === "view" ? (
          <Button variant="outline" className="min-w-32" onClick={forceClose}>
            返回
          </Button>
        ) : null);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
        title={title}
        size="full"
        closeOnOverlayClick={false}
        contentClassName={cn("px-4 py-4 sm:px-8 sm:py-5", bodyClassName)}
        footer={footerContent ? <div className="flex w-full flex-wrap items-center justify-center gap-3">{footerContent}</div> : undefined}
      >
        {typeof children === "function" ? children(context) : children}
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={DIRTY_GUARD_TITLE}
        description={DIRTY_GUARD_MESSAGE}
        onConfirm={forceClose}
      />
    </>
  );
}
