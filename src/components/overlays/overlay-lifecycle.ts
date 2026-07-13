import { useEffect, useRef, type RefObject } from "react";

export type OverlaySize = "sm" | "md" | "lg" | "xl";

const widthBySize: Record<OverlaySize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function overlayWidthClass(size: OverlaySize) {
  return widthBySize[size];
}

export function useOverlayLifecycle({
  open,
  onOpenChange,
  initialFocusRef,
  closeOnEsc = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnEsc?: boolean;
}) {
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // The open/close lifecycle must run exactly once per open, no matter how
  // often the parent re-renders. Controlled forms re-render on every
  // keystroke, and an inline onOpenChange gets a new identity each time — if
  // the effect depended on it, its cleanup would run mid-typing and steal
  // focus back to the trigger element (issue #22). Latest callback/config
  // values are read through refs instead.
  const latestRef = useRef({ onOpenChange, initialFocusRef, closeOnEsc });
  useEffect(() => {
    latestRef.current = { onOpenChange, initialFocusRef, closeOnEsc };
  });

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimeoutId = window.setTimeout(() => {
      const target =
        latestRef.current.initialFocusRef?.current ?? closeButtonRef.current;
      target?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && latestRef.current.closeOnEsc) {
        event.preventDefault();
        latestRef.current.onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimeoutId);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  return { closeButtonRef };
}
