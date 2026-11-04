"use client";

import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TagTone } from "@/components/kit/ui/types";

/** Soft tones follow ReUI Badge *-light recipes (tint + deep ink; dark flips to bright ink). */
const TONE_CLASS: Record<TagTone, string> = {
  default:
    "border-border bg-transparent text-foreground dark:bg-input/32",
  processing:
    "border-info/15 bg-info/10 text-info-foreground dark:border-info/25 dark:bg-info/15 dark:text-info",
  success:
    "border-success/15 bg-success/10 text-success-foreground dark:border-success/25 dark:bg-success/15 dark:text-success",
  warning:
    "border-warning/15 bg-warning/10 text-warning-foreground dark:border-warning/25 dark:bg-warning/15 dark:text-warning",
  error:
    "border-destructive/15 bg-destructive/10 text-destructive-foreground dark:border-destructive/25 dark:bg-destructive/15 dark:text-destructive",
};

const SOLID_TONE_CLASS: Record<TagTone, string> = {
  default: "border-transparent bg-invert text-invert-foreground",
  processing: "border-transparent bg-info text-white",
  success: "border-transparent bg-success text-white",
  warning: "border-transparent bg-warning text-white",
  error: "border-transparent bg-destructive text-white",
};

/** Identity colors (ReUI): tint + border use the hue; label stays on --foreground. */
function customColorStyle(color: string, solid: boolean): CSSProperties {
  if (solid) {
    return { backgroundColor: color, borderColor: "transparent", color: "#fff" };
  }
  return {
    color: "var(--foreground)",
    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
    ["--tag-ink" as string]: color,
  };
}

export interface TagProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  /** Preset tone (default gray). Ignored when `color` is set. */
  tone?: TagTone;
  /** Any CSS color → colored text on a light tint (or white text when solid). */
  color?: string | null;
  /** Filled pill with white text, e.g. 优先级「加急」. */
  solid?: boolean;
  bordered?: boolean;
  /** Fully rounded pill. */
  round?: boolean;
  size?: "sm" | "md";
  icon?: ReactNode;
  closable?: boolean;
  onClose?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function Tag({
  tone = "default",
  color,
  solid = false,
  bordered = true,
  round = false,
  size = "md",
  icon,
  closable = false,
  onClose,
  className,
  style,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      {...rest}
      style={color ? { ...customColorStyle(color, solid), ...style } : style}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap border align-middle",
        size === "sm" ? "h-5 px-1.5 text-xs leading-[18px]" : "h-[22px] px-2 text-xs leading-5",
        round ? "rounded-full" : "rounded-[4px]",
        !color && (solid ? SOLID_TONE_CLASS[tone] : TONE_CLASS[tone]),
        color &&
          !solid &&
          "dark:[background-color:color-mix(in_srgb,var(--tag-ink)_18%,transparent)] dark:[border-color:color-mix(in_srgb,var(--tag-ink)_36%,transparent)]",
        !bordered && "border-transparent",
        className,
      )}
    >
      {icon ? <span className="inline-flex shrink-0 [&>svg]:size-3">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
      {closable ? (
        <button
          type="button"
          aria-label="移除"
          tabIndex={-1}
          className="-mr-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-[4px] opacity-60 transition-opacity hover:opacity-100"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            onClose?.(event);
          }}
        >
          <X className="size-3" strokeWidth={2.2} />
        </button>
      ) : null}
    </span>
  );
}

export interface StatusTagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
  /** Leading status dot. */
  dot?: boolean;
  children?: ReactNode;
}

/** StatusTag — lifecycle status label: ReUI light tint + deep text. */
export function StatusTag({
  tone = "default",
  dot = false,
  className,
  children,
  ...rest
}: StatusTagProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex h-[22px] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-2 text-xs leading-5",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export interface ColorDotLabelProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  /** Option color; without it the label renders as plain text. */
  color?: string | null;
  /** Show the leading dot (default true). */
  dot?: boolean;
  /** Paint the text in the color too. */
  colorText?: boolean;
  children: ReactNode;
}

/** ColorDotLabel — colored option text with a small leading dot.
 * Text stays on `--foreground` by default so dark ink option colors stay readable. */
export function ColorDotLabel({
  color,
  dot = true,
  colorText = false,
  className,
  children,
  ...rest
}: ColorDotLabelProps) {
  return (
    <span
      {...rest}
      className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 text-foreground", className)}
      style={color && colorText ? { color, ...rest.style } : rest.style}
    >
      {color && dot ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
