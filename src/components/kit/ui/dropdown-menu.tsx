"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { FLOATING_PANEL_CLASS, optionRowClass } from "@/components/kit/ui/control-styles";
import {
  useControllableState,
  useFloatingPosition,
  useHoverIntent,
  useLayerDismiss,
  type Placement,
} from "@/components/kit/ui/floating";
import { FloatingLayer } from "@/components/kit/ui/layer";
import type { MenuItem } from "@/components/kit/ui/types";

export interface DropdownMenuProps {
  items: MenuItem[];
  /** The trigger (wrapped in an inline-flex span). */
  children: ReactNode;
  /** hover  or click (default). */
  trigger?: "hover" | "click";
  placement?: Placement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called with the item key after the item's own onClick. */
  onSelect?: (key: string) => void;
  disabled?: boolean;
  /** Minimum panel width in px (default 120). */
  minWidth?: number;
  /** Content above / below the items (e.g. user info). */
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  anchorClassName?: string;
  "aria-label"?: string;
}

function enabledItems(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
  );
}

/** DropdownMenu — vertical action menu; items may be danger / disabled / dividers. */
export function DropdownMenu({
  items,
  children,
  trigger = "click",
  placement = "bottom-end",
  open,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  disabled = false,
  minWidth = 120,
  header,
  footer,
  className,
  anchorClassName,
  "aria-label": ariaLabel,
}: DropdownMenuProps) {
  const layerId = useId();
  const menuId = `${layerId}-menu`;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const focusFirstRef = useRef(false);
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const visible = isOpen && !disabled;
  const hover = useHoverIntent(setOpen, { openDelay: 60, closeDelay: 150 });
  const position = useFloatingPosition({ open: visible, anchorRef, floatingRef, placement, offset: 4 });

  useLayerDismiss({
    open: visible,
    layerId,
    anchorRef,
    onDismiss: (reason) => {
      setOpen(false);
      if (reason === "escape") focusTrigger();
    },
  });

  useEffect(() => {
    if (!visible || !focusFirstRef.current) return;
    focusFirstRef.current = false;
    enabledItems(floatingRef.current)[0]?.focus();
  }, [visible]);

  function focusTrigger() {
    anchorRef.current
      ?.querySelector<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])")
      ?.focus();
  }

  function activate(item: MenuItem) {
    if (item.disabled || item.type === "divider" || item.type === "group") return;
    setOpen(false);
    item.onClick?.();
    onSelect?.(item.key);
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = enabledItems(floatingRef.current);
    const index = list.findIndex((element) => element === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      list[list.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <>
      <span
        ref={anchorRef}
        aria-haspopup="menu"
        aria-expanded={visible}
        aria-controls={visible ? menuId : undefined}
        className={cn("inline-flex max-w-full", anchorClassName)}
        onClick={
          disabled
            ? undefined
            : trigger === "click"
              ? () => setOpen(!isOpen)
              : () => setOpen(true)
        }
        onMouseEnter={trigger === "hover" && !disabled ? hover.onEnter : undefined}
        onMouseLeave={trigger === "hover" && !disabled ? hover.onLeave : undefined}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            focusFirstRef.current = true;
            if (visible) enabledItems(floatingRef.current)[0]?.focus();
            else setOpen(true);
          }
        }}
      >
        {children}
      </span>
      <FloatingLayer
        open={visible}
        layerId={layerId}
        floatingRef={floatingRef}
        style={position.style}
        placement={position.placement}
        className={cn(FLOATING_PANEL_CLASS, "p-1", className)}
        onMouseEnter={trigger === "hover" ? hover.onEnter : undefined}
        onMouseLeave={trigger === "hover" ? hover.onLeave : undefined}
        onKeyDown={handlePanelKeyDown}
      >
        {header}
        <div
          id={menuId}
          role="menu"
          data-bare-control=""
          aria-label={ariaLabel}
          className="flex flex-col gap-0.5"
          style={{ minWidth }}
        >
          {items.map((item) => {
            if (item.type === "divider") {
              return <div key={item.key} role="separator" className="my-1 h-px bg-border-secondary" />;
            }
            if (item.type === "group") {
              return (
                <div key={item.key} className="px-3 pb-1 pt-2 text-xs leading-5 text-text-tertiary">
                  {item.label}
                </div>
              );
            }
            return (
              <button
                type="button"
                key={item.key}
                role="menuitem"
                title={item.title}
                aria-disabled={item.disabled || undefined}
                tabIndex={-1}
                className={cn(
                  optionRowClass({ danger: item.danger, disabled: item.disabled }),
                  !item.disabled && (item.danger ? "hover:bg-danger-soft focus:bg-danger-soft" : "hover:bg-fill-hover focus:bg-fill-hover"),
                  "whitespace-nowrap focus:outline-none",
                )}
                onClick={() => activate(item)}
              >
                {item.icon ? (
                  <span className="flex shrink-0 items-center [&>svg]:size-4">{item.icon}</span>
                ) : null}
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.extra ? <span className="ml-3 shrink-0">{item.extra}</span> : null}
              </button>
            );
          })}
        </div>
        {footer}
      </FloatingLayer>
    </>
  );
}
