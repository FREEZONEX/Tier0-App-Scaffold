"use client";

import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TagTone } from "@/components/kit/ui/types";

const TONE_CLASS: Record<TagTone, string> = {
  default: "state-idle",
  processing: "state-info",
  success: "state-running",
  warning: "state-paused",
  error: "state-error",
};

const SOLID_TONE_CLASS: Record<TagTone, string> = {
  default: "border-transparent bg-[#8c8c8c] text-white",
  processing: "border-transparent bg-brand text-white",
  success: "border-transparent bg-success text-white",
  warning: "border-transparent bg-warning text-white",
  error: "border-transparent bg-danger text-white",
};

function customColorStyle(color: string, solid: boolean): CSSProperties {
  if (solid) return { backgroundColor: color, borderColor: "transparent", color: "#fff" };
  return {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 9%, white)`,
    borderColor: `color-mix(in srgb, ${color} 32%, white)`,
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
        round ? "rounded-full" : "rounded-sm",
        !color && (solid ? SOLID_TONE_CLASS[tone] : TONE_CLASS[tone]),
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
          className="-mr-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm opacity-60 transition-opacity hover:opacity-100"
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
  children: ReactNode;
}

/** StatusTag — lifecycle status label: light tint background, deep text. */
export function StatusTag({ tone = "default", dot = false, className, children, ...rest }: StatusTagProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex h-[22px] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-xs leading-5",
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

/** ColorDotLabel — colored option text with a small leading dot. */
export function ColorDotLabel({
  color,
  dot = true,
  colorText = true,
  className,
  children,
  ...rest
}: ColorDotLabelProps) {
  return (
    <span
      {...rest}
      className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}
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
