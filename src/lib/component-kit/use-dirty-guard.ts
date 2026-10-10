"use client";

/**
 * 未提交修改关闭确认:
 * 「提示：有未提交的修改，确定关闭吗？」取消 / 确认.
 *
 *   const guard = useDirtyGuard(form, { open });
 *   <FormDrawer open={open} onOpenChange={(next) => !next && guard.requestClose(() => setOpen(false))} … />
 *   <ConfirmDialog open={guard.confirmOpen} onOpenChange={guard.setConfirmOpen}
 *     title={DIRTY_GUARD_TITLE} description={DIRTY_GUARD_MESSAGE} onConfirm={guard.confirmClose} />
 *
 * FormDrawer / FullscreenModal accept `dirty` and render this confirmation
 * themselves; use the hook directly only with other containers.
 *
 * The snapshot is taken when `open` turns true (or on `markClean`), so values
 * loaded asynchronously right after opening should call `markClean(loaded)`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { stableKey } from "@/lib/component-kit/query-model";

export const DIRTY_GUARD_TITLE = "提示";
export const DIRTY_GUARD_MESSAGE = "有未提交的修改，确定关闭吗？";

export interface DirtyGuardOptions {
  /** The container is open; the baseline snapshot is taken on open. */
  open: boolean;
  /** Disable the guard (e.g. view mode). */
  enabled?: boolean;
}

export interface DirtyGuard {
  dirty: boolean;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  /** Close immediately when clean, otherwise ask first. */
  requestClose: (close: () => void) => void;
  /** Run the pending close (confirm button). */
  confirmClose: () => void;
  /** Treat the current (or given) value as saved. */
  markClean: (value?: unknown) => void;
}

export function isSameValue(a: unknown, b: unknown): boolean {
  return stableKey(a ?? null) === stableKey(b ?? null);
}

export function useDirtyGuard(value: unknown, options: DirtyGuardOptions): DirtyGuard {
  const { open, enabled = true } = options;
  const [baseline, setBaseline] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    // Snapshot once per open; reset when closed.
    setBaseline(open ? stableKey(valueRef.current ?? null) : null);
    if (!open) {
      pendingCloseRef.current = null;
      setConfirmOpen(false);
    }
  }, [open]);

  const dirty = Boolean(enabled && open && baseline !== null && stableKey(value ?? null) !== baseline);

  useEffect(() => {
    if (!dirty || typeof window === "undefined") return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = DIRTY_GUARD_MESSAGE;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const requestClose = useCallback(
    (close: () => void) => {
      if (!dirty) {
        close();
        return;
      }
      pendingCloseRef.current = close;
      setConfirmOpen(true);
    },
    [dirty],
  );

  const confirmClose = useCallback(() => {
    const close = pendingCloseRef.current;
    pendingCloseRef.current = null;
    setConfirmOpen(false);
    close?.();
  }, []);

  const markClean = useCallback((next?: unknown) => {
    setBaseline(stableKey((next === undefined ? valueRef.current : next) ?? null));
  }, []);

  const handleConfirmOpen = useCallback((next: boolean) => {
    if (!next) pendingCloseRef.current = null;
    setConfirmOpen(next);
  }, []);

  return { dirty, confirmOpen, setConfirmOpen: handleConfirmOpen, requestClose, confirmClose, markClean };
}
