"use client";

/**
 * Floating-layer plumbing shared by Popover, DropdownMenu, Tooltip, Select and
 * the date pickers:
 *
 * - useFloatingPosition: fixed positioning next to an anchor with viewport
 *   flip + shift, kept in sync on scroll / resize / size changes.
 * - useLayerDismiss: outside pointer-down and Escape handling that respects
 *   nested layers (a Select opened inside a Popover is "inside" the Popover)
 *   and only lets the top-most layer consume Escape (scaffold Dialogs check
 *   `event.defaultPrevented`, so an open dropdown does not close its dialog).
 * - useControllableState / useHoverIntent helpers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

export type Placement =
  | "bottom-start"
  | "bottom"
  | "bottom-end"
  | "top-start"
  | "top"
  | "top-end"
  | "left-start"
  | "left"
  | "left-end"
  | "right-start"
  | "right"
  | "right-end";

export const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** z-index of floating layers: above scaffold overlays (z-50). */
export const FLOATING_Z_INDEX = 1050;
export const TOOLTIP_Z_INDEX = 1070;

/* ------------------------------------------------------------------ */
/* Controlled / uncontrolled state                                     */
/* ------------------------------------------------------------------ */

export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const setValue = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChangeRef.current?.(next);
    },
    [controlled],
  );
  return [current, setValue];
}

/* ------------------------------------------------------------------ */
/* Positioning                                                          */
/* ------------------------------------------------------------------ */

export interface FloatingPositionOptions {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  floatingRef: RefObject<HTMLElement | null>;
  placement?: Placement;
  /** Gap between anchor and panel in px. */
  offset?: number;
  /** true = panel width equals anchor width; "min" = at least the anchor width. */
  sameWidth?: boolean | "min";
  /** Keep this many px away from the viewport edge. */
  viewportPadding?: number;
  zIndex?: number;
}

export interface FloatingPosition {
  style: CSSProperties;
  placement: Placement;
}

interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function splitPlacement(placement: Placement): [string, string] {
  const [side, align = "center"] = placement.split("-");
  return [side, align];
}

export function computeFloatingPosition(
  anchor: Rect,
  floating: { width: number; height: number },
  placement: Placement,
  offset: number,
  padding: number,
  viewport: { width: number; height: number },
): { top: number; left: number; placement: Placement; maxHeight: number } {
  const [side, align] = splitPlacement(placement);
  const vw = viewport.width;
  const vh = viewport.height;
  const fw = floating.width;
  const fh = floating.height;

  if (side === "bottom" || side === "top") {
    const spaceBelow = vh - anchor.bottom - offset - padding;
    const spaceAbove = anchor.top - offset - padding;
    let finalSide = side;
    if (side === "bottom" && fh > spaceBelow && spaceAbove > spaceBelow) finalSide = "top";
    if (side === "top" && fh > spaceAbove && spaceBelow > spaceAbove) finalSide = "bottom";
    let top = finalSide === "bottom" ? anchor.bottom + offset : anchor.top - offset - fh;
    const maxHeight = Math.max(80, finalSide === "bottom" ? spaceBelow : spaceAbove);
    if (finalSide === "top" && top < padding) top = padding;

    let left =
      align === "start"
        ? anchor.left
        : align === "end"
          ? anchor.right - fw
          : anchor.left + (anchor.width - fw) / 2;
    left = Math.min(left, vw - padding - fw);
    left = Math.max(left, padding);

    const nextPlacement = (align === "center" ? finalSide : `${finalSide}-${align}`) as Placement;
    return { top, left, placement: nextPlacement, maxHeight };
  }

  const spaceRight = vw - anchor.right - offset - padding;
  const spaceLeft = anchor.left - offset - padding;
  let finalSide = side;
  if (side === "right" && fw > spaceRight && spaceLeft > spaceRight) finalSide = "left";
  if (side === "left" && fw > spaceLeft && spaceRight > spaceLeft) finalSide = "right";
  let left = finalSide === "right" ? anchor.right + offset : anchor.left - offset - fw;
  left = Math.max(padding, Math.min(left, vw - padding - fw));

  let top =
    align === "start"
      ? anchor.top
      : align === "end"
        ? anchor.bottom - fh
        : anchor.top + (anchor.height - fh) / 2;
  top = Math.min(top, vh - padding - fh);
  top = Math.max(top, padding);

  const nextPlacement = (align === "center" ? finalSide : `${finalSide}-${align}`) as Placement;
  return { top, left, placement: nextPlacement, maxHeight: vh - padding * 2 };
}

const HIDDEN_STYLE: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  visibility: "hidden",
};

export function useFloatingPosition({
  open,
  anchorRef,
  floatingRef,
  placement = "bottom-start",
  offset = 4,
  sameWidth = false,
  viewportPadding = 8,
  zIndex = FLOATING_Z_INDEX,
}: FloatingPositionOptions): FloatingPosition {
  const [position, setPosition] = useState<FloatingPosition>({
    style: { ...HIDDEN_STYLE, zIndex },
    placement,
  });
  const frameRef = useRef<number | null>(null);

  const update = useCallback(() => {
    const anchorEl = anchorRef.current;
    const floatingEl = floatingRef.current;
    if (!anchorEl || !floatingEl) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const widthStyle: CSSProperties =
      sameWidth === true
        ? { width: anchorRect.width }
        : sameWidth === "min"
          ? { minWidth: anchorRect.width }
          : {};
    // Measure with the width constraint applied so wrapping is final.
    if (sameWidth === true) floatingEl.style.width = `${anchorRect.width}px`;
    if (sameWidth === "min") floatingEl.style.minWidth = `${anchorRect.width}px`;
    const next = computeFloatingPosition(
      anchorRect,
      { width: floatingEl.offsetWidth, height: floatingEl.offsetHeight },
      placement,
      offset,
      viewportPadding,
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPosition((current) => {
      const style: CSSProperties = {
        position: "fixed",
        top: Math.round(next.top),
        left: Math.round(next.left),
        zIndex,
        ...widthStyle,
      };
      if (
        current.placement === next.placement &&
        current.style.top === style.top &&
        current.style.left === style.left &&
        current.style.width === style.width &&
        current.style.minWidth === style.minWidth &&
        current.style.visibility === undefined
      ) {
        return current;
      }
      return { style, placement: next.placement };
    });
  }, [anchorRef, floatingRef, placement, offset, sameWidth, viewportPadding, zIndex]);

  useIsoLayoutEffect(() => {
    if (!open) {
      setPosition({ style: { ...HIDDEN_STYLE, zIndex }, placement });
      return;
    }
    update();

    function schedule(event?: Event) {
      if (
        event?.type === "scroll" &&
        event.target instanceof Node &&
        floatingRef.current?.contains(event.target)
      ) {
        return;
      }
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        update();
      });
    }

    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    if (observer) {
      if (anchorRef.current) observer.observe(anchorRef.current);
      if (floatingRef.current) observer.observe(floatingRef.current);
    }
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer?.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [open, update]);

  return position;
}

/* ------------------------------------------------------------------ */
/* Layer nesting + dismissal                                            */
/* ------------------------------------------------------------------ */

/** Ids of the floating layers that contain the current React subtree. */
export const LayerPathContext = createContext<readonly string[]>([]);

export function useLayerPath(): readonly string[] {
  return useContext(LayerPathContext);
}

const openLayerStack: string[] = [];

function removeLayer(id: string) {
  const index = openLayerStack.lastIndexOf(id);
  if (index >= 0) openLayerStack.splice(index, 1);
}

export function isTopLayer(id: string): boolean {
  return openLayerStack[openLayerStack.length - 1] === id;
}

/** True when `target` is inside the layer `id` or inside a layer nested in it. */
export function isInsideLayer(target: EventTarget | null, id: string): boolean {
  if (!(target instanceof Element)) return false;
  const host = target.closest("[data-lingo-layer-path]");
  if (!host) return false;
  return (host.getAttribute("data-lingo-layer-path") ?? "").split(" ").includes(id);
}

export interface LayerDismissOptions {
  open: boolean;
  layerId: string;
  anchorRef?: RefObject<HTMLElement | null>;
  onDismiss: (reason: "outside" | "escape") => void;
  closeOnOutside?: boolean;
  closeOnEscape?: boolean;
}

export function useLayerDismiss({
  open,
  layerId,
  anchorRef,
  onDismiss,
  closeOnOutside = true,
  closeOnEscape = true,
}: LayerDismissOptions) {
  const latest = useRef({ onDismiss, closeOnOutside, closeOnEscape });
  useEffect(() => {
    latest.current = { onDismiss, closeOnOutside, closeOnEscape };
  });

  useEffect(() => {
    if (!open) return;
    openLayerStack.push(layerId);

    function handlePointerDown(event: PointerEvent) {
      if (!latest.current.closeOnOutside) return;
      const target = event.target;
      if (target instanceof Node && anchorRef?.current?.contains(target)) return;
      if (isInsideLayer(target, layerId)) return;
      latest.current.onDismiss("outside");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !latest.current.closeOnEscape) return;
      if (!isTopLayer(layerId) || event.defaultPrevented) return;
      event.preventDefault();
      latest.current.onDismiss("escape");
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      removeLayer(layerId);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, layerId, anchorRef]);
}

/* ------------------------------------------------------------------ */
/* Hover intent                                                         */
/* ------------------------------------------------------------------ */

export function useHoverIntent(
  setOpen: (open: boolean) => void,
  { openDelay = 80, closeDelay = 120 }: { openDelay?: number; closeDelay?: number } = {},
) {
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const setOpenRef = useRef(setOpen);
  useEffect(() => {
    setOpenRef.current = setOpen;
  });

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const onEnter = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (openTimer.current !== null) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      setOpenRef.current(true);
    }, openDelay);
  }, [openDelay]);

  const onLeave = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpenRef.current(false);
    }, closeDelay);
  }, [closeDelay]);

  return { onEnter, onLeave, clearTimers };
}

/** Animation origin class for a resolved placement. */
export function placementOriginClass(placement: Placement): string {
  const [side, align] = splitPlacement(placement);
  if (side === "bottom") return align === "end" ? "origin-top-right" : align === "start" ? "origin-top-left" : "origin-top";
  if (side === "top") return align === "end" ? "origin-bottom-right" : align === "start" ? "origin-bottom-left" : "origin-bottom";
  if (side === "left") return "origin-right";
  return "origin-left";
}
