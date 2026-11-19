"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/overlays/drawer";
import { FOCUS_FILL } from "@/lib/interaction";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 280;
const MIN_MAIN = 280;
const STEP = 16;
const STEP_LARGE = 48;

function useDesktopDock() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return desktop;
}

function clampDockWidth(width: number, parentWidth: number, minWidth: number, maxWidth?: number) {
  const room = Math.max(minWidth, parentWidth - MIN_MAIN);
  const cap = Math.min(maxWidth ?? Number.POSITIVE_INFINITY, room, Math.round(parentWidth * 0.55));
  const floor = Math.min(minWidth, cap);
  return Math.round(Math.min(Math.max(width, floor), cap));
}

export interface ChatDockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  /** Main work surface (document, form, list). */
  children: ReactNode;
  /** Assistant column: typically a ChatPanel. */
  assistant: ReactNode;
  className?: string;
  /** Initial rail width in px. Drag, arrow keys, or double-click to reset. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * ChatDock — ReUI ai-chat-2 / ai-chat-12: assistant beside the page.
 * Desktop keeps a full-height right rail with a drag handle; below md it
 * becomes a Drawer. Collapsing the rail leaves 「打开助手」 on the main pane.
 */
export function ChatDock({
  open,
  onOpenChange,
  title = "助手",
  children,
  assistant,
  className,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth,
}: ChatDockProps) {
  const desktop = useDesktopDock();
  const dockTitle = typeof title === "string" ? title : "助手";
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(defaultWidth);
  const widthRef = useRef(width);
  widthRef.current = width;
  const [dragging, setDragging] = useState(false);
  const handleId = useId();

  const applyWidth = useCallback(
    (next: number) => {
      const parent = rootRef.current?.getBoundingClientRect().width ?? 0;
      if (!parent) {
        setWidth(next);
        return;
      }
      setWidth(clampDockWidth(next, parent, minWidth, maxWidth));
    },
    [minWidth, maxWidth],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => applyWidth(widthRef.current));
    observer.observe(el);
    return () => observer.disconnect();
  }, [applyWidth]);

  useEffect(() => {
    if (!dragging) return;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [dragging]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const parent = rootRef.current?.getBoundingClientRect();
    if (!parent) return;
    applyWidth(parent.right - event.clientX);
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const parent = rootRef.current?.getBoundingClientRect().width ?? 0;
    const max = clampDockWidth(parent, parent, minWidth, maxWidth);
    const step = event.shiftKey ? STEP_LARGE : STEP;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyWidth(width + step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      applyWidth(width - step);
    } else if (event.key === "Home") {
      event.preventDefault();
      applyWidth(minWidth);
    } else if (event.key === "End") {
      event.preventDefault();
      applyWidth(max);
    }
  };

  return (
    <div
      ref={rootRef}
      data-slot="chat-dock"
      className={cn("flex h-full min-h-0 min-w-0 flex-1", className)}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {open ? (
          <div className="flex justify-end px-3 py-2 md:hidden">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              aria-label="收起助手"
              title="收起助手"
              onClick={() => onOpenChange(false)}
            >
              <PanelRightClose aria-hidden />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 z-10"
            aria-label="打开助手"
            title="打开助手"
            onClick={() => onOpenChange(true)}
          >
            <PanelRightOpen aria-hidden />
            打开助手
          </Button>
        )}
        {children}
      </div>
      <aside
        className={cn(
          "relative hidden min-h-0 shrink-0 self-stretch overflow-hidden md:block",
          !open && "pointer-events-none",
          !dragging &&
            "motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear",
        )}
        style={{ width: desktop ? (open ? width : 0) : undefined }}
        aria-hidden={!open}
        inert={!open || undefined}
      >
        <div
          className="absolute inset-y-0 right-0 flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-card"
          style={{ width }}
        >
          {desktop ? (
            <div
              id={handleId}
              role="separator"
              aria-orientation="vertical"
              aria-label="调整助手宽度"
              aria-valuemin={minWidth}
              aria-valuenow={width}
              aria-valuetext={`${width} 像素`}
              tabIndex={open ? 0 : -1}
              data-dragging={dragging || undefined}
              className={cn(
                "absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none",
                "pointer-coarse:w-11",
                FOCUS_FILL,
                "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent",
                "hover:after:bg-foreground/25 data-[dragging]:after:bg-foreground/40",
              )}
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onDoubleClick={() => applyWidth(defaultWidth)}
              onKeyDown={onHandleKeyDown}
            />
          ) : null}
          {desktop ? assistant : null}
        </div>
      </aside>
      {!desktop ? (
        <Drawer
          open={open}
          onOpenChange={onOpenChange}
          side="right"
          size="sm"
          title={dockTitle}
          contentClassName="p-0"
        >
          <div className="flex h-full min-h-0 flex-col">{assistant}</div>
        </Drawer>
      ) : null}
    </div>
  );
}
