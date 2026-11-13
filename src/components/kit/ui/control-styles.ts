/**
 * Shared class recipes for form controls (Input, Select, pickers…).
 * Visual recipe follows ReUI/shadcn; colors come from Tier0 tokens.
 */
import { cn } from "@/lib/utils";

/** sm = 32px, md = 36px (default), lg = 40px. */
export type ControlSize = "sm" | "md" | "lg";
export type ControlStatus = "error" | "warning";
/** outlined = bordered field; filled = same surface; borderless = table cells. */
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
  sm: "text-[length:var(--tier0-control-text-sm)]",
  md: "text-sm",
  lg: "text-sm",
};

export const CONTROL_PADDING_X: Record<ControlSize, string> = {
  sm: "px-2",
  md: "px-2.5",
  lg: "px-3",
};

export const CONTROL_RADIUS: Record<ControlSize, string> = {
  sm: "rounded-[4px]",
  md: "rounded-[4px]",
  lg: "rounded-[4px]",
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
 * Outer frame of a composite control — ReUI focus ring + Tier0 colors.
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
    "relative flex w-full min-w-0 items-center border bg-transparent text-foreground outline-none transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
    fixedHeight ? CONTROL_FIXED_HEIGHT[size] : CONTROL_HEIGHT[size],
    CONTROL_TEXT[size],
    CONTROL_RADIUS[size],
    variant === "outlined" && "border-input bg-card shadow-xs",
    variant === "filled" && "border-input bg-card",
    variant === "borderless" && "border-transparent bg-transparent",
    !disabled &&
      variant !== "borderless" &&
      !status &&
      "hover:border-[color-mix(in_srgb,var(--input)_70%,var(--foreground))] focus-within:border-ring/40 focus-within:ring-2 focus-within:ring-ring/40",
    !disabled &&
      variant === "borderless" &&
      "hover:bg-muted/60 focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/40",
    !disabled &&
      active &&
      !status &&
      variant !== "borderless" &&
      "border-ring/40 ring-2 ring-ring/40",
    status === "error" &&
      "border-destructive focus-within:border-destructive focus-within:ring-3 focus-within:ring-destructive/20",
    status === "error" && active && "border-destructive ring-3 ring-destructive/20",
    status === "warning" &&
      "border-warning focus-within:border-warning focus-within:ring-3 focus-within:ring-warning/20",
    disabled &&
      "tier0-control-disabled cursor-not-allowed border-input bg-input/50 text-muted-foreground opacity-50",
    disabled && variant === "borderless" && "border-transparent bg-transparent opacity-50",
  );
}

/** Class for the bare native <input>/<textarea> inside a control frame. */
export const BARE_INPUT_CLASS =
  "m-0 min-h-0 w-full min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent p-0 text-inherit leading-5 shadow-none outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-transparent";

/** Floating panel surface (dropdowns, popovers, pickers) — ReUI popup recipe. */
export const FLOATING_PANEL_CLASS =
  "rounded-[4px] border border-border/70 bg-popover text-popover-foreground shadow-popup outline-none animate-[tier0-pop_160ms_var(--motion-spring)]";

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
    "flex min-h-8 w-full cursor-pointer select-none items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left text-sm leading-5 transition-colors duration-100",
    danger ? "text-destructive" : "text-foreground",
    /* Light gray hover/active — never bg-muted (muted is white in light theme). */
    !disabled &&
      (danger
        ? "hover:bg-danger-soft focus:bg-danger-soft"
        : "hover:bg-fill-hover focus:bg-fill-hover"),
    active && !disabled && (danger ? "bg-destructive/10" : "bg-fill-hover"),
    selected && !disabled && !danger && "bg-fill-hover font-medium text-foreground",
    disabled && "cursor-not-allowed opacity-50",
  );
}
