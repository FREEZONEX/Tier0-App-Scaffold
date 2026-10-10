"use client";

/** Displays the shared session-expired event emitted by the application adapter.
 * Confirm reloads the page to restart the platform sign-in flow. */
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
