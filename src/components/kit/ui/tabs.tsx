"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";
import { useControllableState, useIsoLayoutEffect } from "@/components/kit/ui/floating";
import type { TabItem } from "@/components/kit/ui/types";

function useInkBar(containerRef: RefObject<HTMLElement | null>, activeIndex: number, deps: unknown[]) {
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);
  useIsoLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function measure() {
      const element = container?.querySelector<HTMLElement>(`[data-tab-index="${activeIndex}"]`);
      setInk(element ? { left: element.offsetLeft, width: element.offsetWidth } : null);
    }
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [containerRef, activeIndex, ...deps]);
  return ink;
}

function focusSibling(event: KeyboardEvent<HTMLElement>, onMove: (index: number) => void, count: number, index: number) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  const next = (index + (event.key === "ArrowRight" ? 1 : -1) + count) % count;
  onMove(next);
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                 */
/* ------------------------------------------------------------------ */

export interface TabsProps<K extends string = string> {
  items: TabItem<K>[];
  activeKey?: K;
  defaultActiveKey?: K;
  onChange?: (key: K) => void;
  /** line = underline ink bar (default); card = boxed tabs. */
  type?: "line" | "card";
  size?: "sm" | "md" | "lg";
  centered?: boolean;
  /** Right side of the tab bar (e.g. a ＋ button or links). */
  extra?: ReactNode;
  className?: string;
  barClassName?: string;
  "aria-label"?: string;
}

const LINE_SIZE = { sm: "py-2 text-sm", md: "py-3 text-sm", lg: "py-3.5 text-base" } as const;

export function Tabs<K extends string = string>({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  type = "line",
  size = "md",
  centered = false,
  extra,
  className,
  barClassName,
  "aria-label": ariaLabel,
}: TabsProps<K>) {
  const [active, setActive] = useControllableState<K | undefined>(
    activeKey,
    defaultActiveKey ?? items[0]?.key,
    (next) => {
      if (next !== undefined) onChange?.(next);
    },
  );
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = items.findIndex((item) => item.key === active);
  const ink = useInkBar(listRef, activeIndex, [items.length, type, size]);
  const activeItem = items[activeIndex];
  const hasPanes = items.some((item) => item.children !== undefined);

  function select(index: number) {
    const item = items[index];
    if (!item || item.disabled) return;
    setActive(item.key);
    listRef.current?.querySelector<HTMLElement>(`[data-tab-index="${index}"]`)?.focus();
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "flex min-w-0 items-center gap-3",
          type === "line" ? "border-b border-border-secondary" : "border-b border-border-secondary",
          barClassName,
        )}
      >
        <div className="scrollbar-none min-w-0 flex-1 overflow-x-auto">
          <div
            ref={listRef}
            role="tablist"
            aria-label={ariaLabel}
            className={cn(
              "relative flex w-max min-w-full items-end",
              centered && "justify-center",
              type === "line" ? "gap-8" : "gap-1",
            )}
          >
            {items.map((item, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  type="button"
                  key={item.key}
                  role="tab"
                  data-tab-index={index}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  disabled={item.disabled}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap outline-none transition-colors duration-150 focus-visible:text-brand",
                    type === "line"
                      ? cn(LINE_SIZE[size], selected ? "font-medium text-brand" : "text-foreground hover:text-brand-hover")
                      : cn(
                          "-mb-px rounded-t-md border px-4",
                          size === "sm" ? "h-8 text-sm" : size === "lg" ? "h-10 text-base" : "h-9 text-sm",
                          selected
                            ? "border-border-secondary border-b-card bg-card font-medium text-brand"
                            : "border-border-secondary bg-[#fafafa] text-foreground hover:text-brand-hover",
                        ),
                    item.disabled && "cursor-not-allowed text-text-placeholder hover:text-text-placeholder",
                  )}
                  onClick={() => select(index)}
                  onKeyDown={(event) => focusSibling(event, select, items.length, index)}
                >
                  {item.icon ? <span className="flex shrink-0 [&>svg]:size-4">{item.icon}</span> : null}
                  {item.label}
                  {item.count !== undefined ? (
                    <span className="tabular-nums text-text-tertiary">{item.count}</span>
                  ) : null}
                </button>
              );
            })}
            {type === "line" && ink ? (
              <span
                aria-hidden="true"
                className="absolute bottom-0 h-0.5 rounded-full bg-brand transition-[left,width] duration-300"
                style={{ left: ink.left, width: ink.width }}
              />
            ) : null}
          </div>
        </div>
        {extra ? <div className="flex shrink-0 items-center gap-2">{extra}</div> : null}
      </div>
      {hasPanes && activeItem ? (
        <div role="tabpanel" className="min-w-0 pt-4">
          {activeItem.children}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CapsuleGroup                                                         */
/* ------------------------------------------------------------------ */

export interface CapsuleGroupProps<K extends string | number = string> {
  items: TabItem<K>[];
  value?: K;
  defaultValue?: K;
  onChange?: (key: K) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/** CapsuleGroup — pill filters with counts (「全部 45」「返工单 22」). */
export function CapsuleGroup<K extends string | number = string>({
  items,
  value,
  defaultValue,
  onChange,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: CapsuleGroupProps<K>) {
  const [selected, setSelected] = useControllableState<K | undefined>(value, defaultValue ?? items[0]?.key);
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const active = item.key === selected;
        return (
          <button
            type="button"
            key={String(item.key)}
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-border",
              size === "sm" ? "h-7 px-3 text-sm" : "h-8 px-4 text-sm",
              active
                ? "bg-brand-soft font-medium text-brand"
                : "bg-[#f3f5f8] text-text-secondary hover:bg-[#e9edf2] hover:text-foreground",
              item.disabled && "cursor-not-allowed opacity-50",
            )}
            onClick={() => {
              setSelected(item.key);
              onChange?.(item.key);
            }}
          >
            {item.icon ? <span className="flex shrink-0 [&>svg]:size-3.5">{item.icon}</span> : null}
            <span>{item.label}</span>
            {item.count !== undefined ? <span className="tabular-nums">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AnchorTabs                                                           */
/* ------------------------------------------------------------------ */

export interface AnchorTabsProps {
  items: { key: string; label: ReactNode }[];
  /** Scroll container whose sections carry data-anchor-key="<key>". */
  containerRef: RefObject<HTMLElement | null>;
  activeKey?: string;
  onChange?: (key: string) => void;
  /** Pixels kept above a section after jumping to it. */
  offset?: number;
  size?: "sm" | "md";
  centered?: boolean;
  className?: string;
}

function findSection(container: HTMLElement, key: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-anchor-key="${CSS.escape(key)}"]`);
}

/** AnchorTabs — section jump tabs with scroll-spy highlight (表单分区锚点). */
export function AnchorTabs({
  items,
  containerRef,
  activeKey,
  onChange,
  offset = 0,
  size = "md",
  centered = true,
  className,
}: AnchorTabsProps) {
  const [active, setActive] = useControllableState(activeKey, items[0]?.key ?? "", onChange);
  const lockRef = useRef<number | null>(null);
  const activeRef = useRef(active);
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = items.findIndex((item) => item.key === active);
  const ink = useInkBar(listRef, activeIndex, [items.length, size]);
  const itemsKey = items.map((item) => item.key).join("|");

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const keys = itemsKey.split("|").filter(Boolean);

    function handleScroll() {
      if (!container || lockRef.current !== null) return;
      const top = container.getBoundingClientRect().top + offset + 12;
      let current = keys[0];
      for (const key of keys) {
        const section = findSection(container, key);
        if (section && section.getBoundingClientRect().top <= top) current = key;
      }
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
        current = keys[keys.length - 1];
      }
      if (current && current !== activeRef.current) {
        activeRef.current = current;
        setActive(current);
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (lockRef.current !== null) {
        window.clearTimeout(lockRef.current);
        lockRef.current = null;
      }
    };
  }, [containerRef, itemsKey, offset, setActive]);

  function jump(key: string) {
    const container = containerRef.current;
    activeRef.current = key;
    setActive(key);
    if (!container) return;
    const section = findSection(container, key);
    if (!section) return;
    const delta = section.getBoundingClientRect().top - container.getBoundingClientRect().top - offset;
    if (lockRef.current !== null) window.clearTimeout(lockRef.current);
    lockRef.current = window.setTimeout(() => {
      lockRef.current = null;
    }, 700);
    container.scrollTo({ top: container.scrollTop + delta, behavior: "smooth" });
  }

  return (
    <div className={cn("scrollbar-none min-w-0 overflow-x-auto", className)}>
      <div
        ref={listRef}
        role="tablist"
        className={cn("relative flex w-max min-w-full items-stretch gap-8", centered && "justify-center")}
      >
        {items.map((item, index) => {
          const selected = item.key === active;
          return (
            <button
              type="button"
              key={item.key}
              role="tab"
              data-tab-index={index}
              aria-selected={selected}
              className={cn(
                "relative inline-flex shrink-0 items-center whitespace-nowrap outline-none transition-colors duration-150 focus-visible:text-brand",
                size === "sm" ? "py-2 text-sm" : "py-3 text-sm",
                selected ? "font-medium text-brand" : "text-foreground hover:text-brand-hover",
              )}
              onClick={() => jump(item.key)}
              onKeyDown={(event) => focusSibling(event, (next) => jump(items[next].key), items.length, index)}
            >
              {item.label}
            </button>
          );
        })}
        {ink ? (
          <span
            aria-hidden="true"
            className="absolute bottom-0 h-0.5 rounded-full bg-brand transition-[left,width] duration-300"
            style={{ left: ink.left, width: ink.width }}
          />
        ) : null}
      </div>
    </div>
  );
}
