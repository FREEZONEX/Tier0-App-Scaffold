import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Button — implements the DESIGN.md button recipes. Use this instead of
 * hand-styling native buttons: variants carry the brand palette and states.
 *
 * - highlight: brand lime fill — the ONE most important action on a screen.
 * - primary:   ink fill — standard primary/submit actions.
 * - secondary: soft surface fill — supporting actions.
 * - outline:   white with border — cancel/neutral actions.
 * - ghost:     borderless — low-emphasis inline/row actions.
 */
export type ButtonVariant =
  | "highlight"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost";

export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  highlight:
    "bg-highlight-bg-primary text-accent-foreground border border-transparent hover:brightness-95",
  primary:
    "bg-primary text-primary-foreground border border-transparent hover:bg-[color:var(--tier0-primary-hover)]",
  secondary:
    "bg-surface-inset text-secondary-foreground border border-border hover:bg-secondary",
  outline:
    "bg-card text-foreground border border-border-strong hover:bg-surface-inset",
  ghost:
    "bg-transparent text-secondary-foreground border border-transparent hover:bg-surface-inset",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", type = "button", className, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium leading-none transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "disabled:pointer-events-none disabled:opacity-55",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
