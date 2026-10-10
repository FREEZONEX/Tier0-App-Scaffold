/**
 * Shared class recipes for form controls (Input, Select, pickers…).
 * Kept in a .ts module so component files only export components.
 */
import { cn } from "@/lib/utils";

/** sm = 36px, md = 40px (default), lg = 44px. */
export type ControlSize = "sm" | "md" | "lg";
export type ControlStatus = "error" | "warning";
/** outlined = white box with border; filled = white themed box; borderless = no frame (table cells). */
export type ControlVariant = "outlined" | "filled" | "borderless";

export const CONTROL_HEIGHT: Record<ControlSize, string> = {
  sm: "min-h-[var(--tier0-control-height-sm)]",
  md: "min-h-[var(--tier0-control-height-md)]",
  lg: "min-h-[var(--tier0-control-height-lg)]",
};

export const CONTROL_FIXED_HEIGHT: Record<ControlSize, string> = {
  sm: "h-[var(--tier0-control-height-sm)]",
  md: "h-[var(--tier0-control-height-md)]",
  lg: "h-[var(--tier0-control-height-lg)]",
};

export const CONTROL_TEXT: Record<ControlSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

export const CONTROL_PADDING_X: Record<ControlSize, string> = {
  sm: "px-[7px]",
  md: "px-[11px]",
  lg: "px-[11px]",
};

export const CONTROL_RADIUS: Record<ControlSize, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
};

export interface ControlFrameOptions {
  size?: ControlSize;
  status?: ControlStatus;
  variant?: ControlVariant;
  disabled?: boolean;
  /** Force the focused look (e.g. while a dropdown panel is open). */
  active?: boolean;
  /** Fixed single-line height instead of min-height (tag selectors grow otherwise). */
  fixedHeight?: boolean;
}

/**
 * Outer frame of a composite control: border, radius, hover/focus ring,
 * status colors and disabled fill. Inner native elements carry
 * `data-bare-control` so the global input backstops leave them alone.
 */
export function controlFrameClass({
  size = "md",
  status,
  variant = "outlined",
  disabled = false,
  active = false,
  fixedHeight = false,
}: ControlFrameOptions = {}): string {
  return cn(
    "relative flex w-full min-w-0 items-center border text-foreground transition-[border-color,box-shadow,background-color] duration-150",
    fixedHeight ? CONTROL_FIXED_HEIGHT[size] : CONTROL_HEIGHT[size],
    CONTROL_TEXT[size],
    CONTROL_RADIUS[size],
    variant === "outlined" && "border-border-strong bg-card",
    variant === "filled" && "border-border-strong bg-card",
    variant === "borderless" && "border-transparent bg-transparent",
    !disabled &&
      variant === "outlined" &&
      !status &&
      "hover:border-brand-hover focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgb(115_178_0/0.15)]",
    !disabled &&
      variant === "filled" &&
      !status &&
      "hover:bg-card focus-within:border-brand focus-within:bg-card focus-within:shadow-[0_0_0_2px_rgb(115_178_0/0.15)]",
    !disabled &&
      variant === "borderless" &&
      "hover:bg-fill-hover focus-within:bg-card focus-within:shadow-[inset_0_0_0_1px_var(--tier0-primary)]",
    !disabled &&
      active &&
      !status &&
      variant !== "borderless" &&
      "border-brand bg-card shadow-[0_0_0_2px_rgb(115_178_0/0.15)]",
    status === "error" &&
      "border-danger hover:border-[#ffa39e] focus-within:border-danger focus-within:shadow-[0_0_0_2px_rgb(255_38_5/0.06)]",
    status === "error" && active && "border-danger shadow-[0_0_0_2px_rgb(255_38_5/0.06)]",
    status === "warning" &&
      "border-warning hover:border-[#ffd666] focus-within:border-warning focus-within:shadow-[0_0_0_2px_rgb(255_215_5/0.1)]",
    disabled &&
      "tier0-control-disabled cursor-not-allowed border-border-strong bg-input-disabled text-text-placeholder hover:border-border-strong",
    disabled && variant === "borderless" && "border-transparent bg-transparent",
  );
}

/** Class for the bare native <input>/<textarea> inside a control frame. */
export const BARE_INPUT_CLASS =
  "m-0 min-h-0 w-full min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent p-0 text-inherit leading-[22px] shadow-none outline-none placeholder:text-text-placeholder disabled:cursor-not-allowed disabled:bg-transparent disabled:text-text-placeholder";

/** Floating panel surface (dropdowns, popovers, pickers). */
export const FLOATING_PANEL_CLASS =
  "rounded-lg bg-popover text-popover-foreground shadow-popup outline-none";

/** One option row inside dropdown lists and menus. */
export function optionRowClass({
  active = false,
  selected = false,
  disabled = false,
  danger = false,
}: {
  active?: boolean;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
}): string {
  return cn(
    "flex min-h-8 w-full cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-[5px] text-left text-sm leading-[22px] transition-colors duration-100",
    danger ? "text-danger" : "text-foreground",
    active && !disabled && (danger ? "bg-danger-soft" : "bg-fill-hover"),
    selected && !disabled && "bg-brand-soft font-medium",
    disabled && "cursor-not-allowed text-text-placeholder",
  );
}
