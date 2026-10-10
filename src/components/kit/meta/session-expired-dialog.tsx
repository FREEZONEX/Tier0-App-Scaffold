"use client";

/**
 * SessionExpiredDialog — 灵动全局会话过期提示 (01 §1、L3 1.1.1): any API call answered with
 * 401 (see `@/lib/api-client`) opens「提示：登录已过期，是否跳转登录页？」with 否 / 是.
 * 是 reloads the page so the Tier0 Gateway can sign the user in again. Mounted once in
 * `src/routes/_app.tsx`.
 */
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "@/lib/component-kit/api-client";

export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, show);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, show);
  }, []);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="提示"
      description={SESSION_EXPIRED_MESSAGE}
      cancelLabel="否"
      confirmLabel="是"
      onConfirm={() => {
        setOpen(false);
        window.location.reload();
      }}
    />
  );
}
