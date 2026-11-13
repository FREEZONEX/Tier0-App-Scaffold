import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — ReUI (@base-ui/react + CVA) recipe.
 * Keeps Tier0 color tokens and business variants; every corner is 4px.
 */
export type ButtonVariant =
  | "highlight"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "link";

/** icon-* sizes keep shadcn/ReUI registry components compatible with this Button. */
export type ButtonSize = "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center rounded-[4px] border border-transparent",
    "bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none",
    "transition-[color,background-color,border-color,box-shadow,transform,filter] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "active:not-aria-[haspopup]:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        highlight:
          "bg-[color:var(--tier0-cta)] text-[color:var(--tier0-cta-foreground)] shadow-[var(--tier0-shadow-highlight-button)] hover:bg-[color:var(--tier0-cta-hover)] active:bg-[color:var(--tier0-cta-active)]",
        primary:
          "bg-primary text-primary-foreground shadow-primary hover:bg-[color:var(--tier0-primary-hover)] active:brightness-95",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary),var(--foreground)_5%)]",
        outline:
          "border-border bg-card text-foreground shadow-xs hover:border-[color-mix(in_srgb,var(--border)_70%,var(--foreground))] hover:bg-muted aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-[color:var(--tier0-primary-hover)]",
        ghost: "hover:bg-muted hover:text-foreground",
        danger:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-[var(--tier0-control-height-sm)] gap-1 px-2.5 text-[length:var(--tier0-control-text-sm)] [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-[var(--tier0-control-height-md)] gap-1.5 px-2.5",
        lg: "h-[var(--tier0-control-height-lg)] gap-1.5 px-3",
        "icon-xs": "size-6 pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        "icon-lg": "size-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      type = "button",
      className,
      icon,
      loading = false,
      block = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <ButtonPrimitive
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-slot="button"
        className={cn(
          buttonVariants({ variant, size }),
          block && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <span
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent animate-in fade-in-0 zoom-in-50"
            aria-hidden
          />
        ) : (
          icon
        )}
        {children}
      </ButtonPrimitive>
    );
  },
);

export { buttonVariants };
