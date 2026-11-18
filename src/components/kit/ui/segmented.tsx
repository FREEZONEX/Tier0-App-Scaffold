"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CONTROL_HEIGHT, type ControlSize } from "@/components/kit/ui/control-styles";
import { useControllableState, useIsoLayoutEffect } from "@/components/kit/ui/floating";
import type { OptionItem } from "@/components/kit/ui/types";

export interface SegmentedProps<V extends string | number = string | number> {
  /** Options, or plain values used as their own labels. */
  options: (OptionItem<V> | V)[];
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  size?: ControlSize;
  /** Stretch to the container width with equal segments. */
  block?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const ITEM_STYLE: Record<ControlSize, string> = { sm: "px-2 text-sm", md: "px-3 text-sm", lg: "px-3 text-base" };

function normalize<V extends string | number>(option: OptionItem<V> | V): OptionItem<V> {
  return typeof option === "object" ? option : { value: option, label: String(option) };
}

/** Segmented — compact single choice with a sliding thumb (e.g. 「A → Z / Z → A」). */
export function Segmented<V extends string | number = string | number>({
  options,
  value,
  defaultValue,
  onChange,
  size = "md",
  block = false,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<V>) {
  const items = options.map(normalize);
  const [selected, setSelected] = useControllableState<V | undefined>(value, defaultValue ?? items.find((item) => !item.disabled)?.value);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const selectedIndex = items.findIndex((item) => item.value === selected);

  useIsoLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function measure() {
      const element = track?.querySelector<HTMLElement>(`[data-segment-index="${selectedIndex}"]`);
      setThumb(element ? { left: element.offsetLeft, width: element.offsetWidth } : null);
    }
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(track);
    track.querySelectorAll<HTMLElement>("[data-segment-index]").forEach(element => observer?.observe(element));
    return () => observer?.disconnect();
  }, [selectedIndex, items.length, size]);

  const focusIndex = items.findIndex((item, index) => !item.disabled && (index === selectedIndex || selectedIndex < 0 || items[selectedIndex]?.disabled));
  const choose = (index: number) => {
    const item = items[index];
    if (!item || disabled || item.disabled || item.value === selected) return;
    setSelected(item.value);
    onChange?.(item.value);
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        "relative inline-flex max-w-full items-stretch gap-0.5 rounded-[4px] border border-border bg-muted/60 p-0.5",
        CONTROL_HEIGHT[size],
        block && "flex w-full",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {thumb ? (
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 rounded-[4px] bg-card shadow-sm ring-1 ring-border/60 transition-transform duration-[var(--motion-base)] ease-[var(--motion-spring)]"
          style={{ left: 0, transform: `translateX(${thumb.left}px)`, width: thumb.width }}
        />
      ) : null}
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const isDisabled = disabled || item.disabled;
        return (
          <button
            type="button"
            key={String(item.value)}
            role="radio"
            aria-checked={isSelected}
            data-segment-index={index}
            disabled={isDisabled}
            tabIndex={!isDisabled && index === focusIndex ? 0 : -1}
            onKeyDown={(event) => {
              const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
              if (!keys.includes(event.key) || disabled) return;
              event.preventDefault();
              const enabled = items.map((item, i) => item.disabled ? -1 : i).filter((i) => i >= 0);
              if (!enabled.length) return;
              const position = enabled.indexOf(index);
              const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
              const backward = event.key === "ArrowUp" || event.key === (rtl ? "ArrowRight" : "ArrowLeft");
              const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled[enabled.length - 1] : enabled[(position + (backward ? -1 : 1) + enabled.length) % enabled.length];
              choose(next);
              trackRef.current?.querySelector<HTMLButtonElement>(`[data-segment-index="${next}"]`)?.focus();
            }}
            className={cn(
              "relative z-10 inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] transition-colors outline-none focus-visible:bg-fill-hover focus-visible:text-foreground",
              ITEM_STYLE[size],
              block && "flex-1",
              isSelected ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              isDisabled && "pointer-events-none opacity-50",
              !thumb && isSelected && "bg-card shadow-sm",
            )}
            onClick={() => choose(index)}
          >
            {item.icon ? <span className="flex shrink-0 [&>svg]:size-4">{item.icon}</span> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
