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

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimeoutId = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? closeButtonRef.current;
      target?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEsc) {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimeoutId);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [closeOnEsc, initialFocusRef, onOpenChange, open]);

  return { closeButtonRef };
}
