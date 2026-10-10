"use client";

/**
 * FormDrawer — 右侧宽抽屉表单: header with
 * title, centered 锚点页签 (AnchorTabs over the form sections), 切换布局
 * (label 在上 ↔ label 在左, remembered per browser), 全屏 / 退出全屏 and ×;
 * scrollable body; footer buttons. With `dirty`, closing (×, Esc, overlay,
 * `requestClose`) asks 「有未提交的修改，确定关闭吗？」 first.
 */
import { LayoutPanelLeft, Maximize2, Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Drawer } from "@/components/overlays/drawer";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { AnchorTabs } from "@/components/kit/ui/tabs";
import { DIRTY_GUARD_MESSAGE, DIRTY_GUARD_TITLE } from "@/lib/component-kit/use-dirty-guard";
import { cn } from "@/lib/utils";

export type FormLayout = "horizontal" | "vertical";

export interface FormContainerContext {
  /** Current label layout (pass to MetaForm). */
  layout: FormLayout;
  /** Close with the unsaved-changes check (use for 取消 buttons). */
  requestClose: () => void;
  /** Close without asking (after a successful submit). */
  forceClose: () => void;
}

export interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** 锚点页签, usually `sections.map(({ key, label }) => ({ key, label }))`. */
  anchors?: { key: string; label: string }[];
  /** Initial label layout when nothing is remembered. */
  defaultLayout?: FormLayout;
  /** localStorage key of the remembered layout. */
  layoutStorageKey?: string;
  /** Show the 切换布局 button (default true). */
  switchableLayout?: boolean;
  /** Unsaved changes → confirm before closing. */
  dirty?: boolean;
  /** Width: xl ≈ 1024px, 2xl ≈ 1200px (default). */
  size?: "xl" | "2xl";
  footer?: ReactNode | ((context: FormContainerContext) => ReactNode);
  children: ReactNode | ((context: FormContainerContext) => ReactNode);
  /** Close when clicking the dimmed backdrop (default false for forms). */
  closeOnOverlayClick?: boolean;
  bodyClassName?: string;
}

const DEFAULT_LAYOUT_KEY = "tier0:form-layout";
/** Gap kept above a section when an anchor scrolls to it. */
const ANCHOR_OFFSET = 8;

function readLayout(key: string, fallback: FormLayout): FormLayout {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === "horizontal" || stored === "vertical" ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeLayout(key: string, layout: FormLayout) {
  try {
    window.localStorage.setItem(key, layout);
  } catch {
    // Storage may be unavailable (private mode); the layout still applies for this session.
  }
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  anchors,
  defaultLayout = "vertical",
  layoutStorageKey = DEFAULT_LAYOUT_KEY,
  switchableLayout = true,
  dirty = false,
  size = "2xl",
  footer,
  children,
  closeOnOverlayClick = false,
  bodyClassName,
}: FormDrawerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [anchorSpacer, setAnchorSpacer] = useState(0);
  const [layout, setLayout] = useState<FormLayout>(() => readLayout(layoutStorageKey, defaultLayout));
  const anchorsKey = anchors && anchors.length > 1 ? anchors.map((anchor) => anchor.key).join("|") : "";

  // Short forms: leave enough room under the last section so every 锚点 can scroll its section to the top.
  useEffect(() => {
    const container = scrollRef.current;
    const content = contentRef.current;
    if (!open || !anchorsKey || !container || !content || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const sections = content.querySelectorAll<HTMLElement>("[data-anchor-key]");
        const last = sections[sections.length - 1];
        if (!last) {
          setAnchorSpacer(0);
          return;
        }
        const style = window.getComputedStyle(container);
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const contentBox = content.getBoundingClientRect();
        const lastTop = last.getBoundingClientRect().top - contentBox.top;
        const needed = paddingTop + lastTop - ANCHOR_OFFSET;
        const maxScroll = paddingTop + contentBox.height + paddingBottom - container.clientHeight;
        const next = Math.max(0, Math.ceil(needed - maxScroll));
        setAnchorSpacer((previous) => (previous === next ? previous : next));
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [anchorsKey, open]);
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const forceClose = useCallback(() => {
    setConfirmOpen(false);
    setFullscreen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const requestClose = useCallback(() => {
    if (confirmOpen) return;
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    forceClose();
  }, [confirmOpen, dirty, forceClose]);

  const context: FormContainerContext = { layout, requestClose, forceClose };

  const toggleLayout = () => {
    const next: FormLayout = layout === "vertical" ? "horizontal" : "vertical";
    setLayout(next);
    writeLayout(layoutStorageKey, next);
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
        title={title}
        size={size}
        closeOnOverlayClick={closeOnOverlayClick}
        className={cn("[&>div:first-child]:hidden", fullscreen && "sm:max-w-none lg:max-w-none")}
        contentClassName="flex flex-col overflow-hidden p-0 sm:p-0"
        footer={typeof footer === "function" ? footer(context) : footer}
      >
        <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-secondary px-4 sm:px-6">
          <h2 className="min-w-0 max-w-[40%] truncate py-3 text-base font-semibold text-foreground">{title}</h2>
          <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
            {anchors && anchors.length > 1 ? (
              <AnchorTabs items={anchors} containerRef={scrollRef} offset={ANCHOR_OFFSET} size="sm" className="min-w-0" />
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {switchableLayout ? (
              <TextButton tone="default" icon={<LayoutPanelLeft />} onClick={toggleLayout} className="mr-1">
                切换布局
              </TextButton>
            ) : null}
            <IconButton
              label={fullscreen ? "退出全屏" : "全屏"}
              icon={fullscreen ? <Minimize2 /> : <Maximize2 />}
              className="hidden sm:inline-flex"
              onClick={() => setFullscreen((value) => !value)}
            />
            <IconButton label="关闭" icon={<X />} onClick={requestClose} />
          </div>
        </div>
        <div ref={scrollRef} className={cn("page-y-scroll min-h-0 min-w-0 flex-1 px-4 py-4 sm:px-6", bodyClassName)}>
          <div ref={contentRef} className="min-w-0">
            {typeof children === "function" ? children(context) : children}
          </div>
          {anchorSpacer > 0 ? <div aria-hidden="true" style={{ height: anchorSpacer }} /> : null}
        </div>
      </Drawer>
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
