"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonSize } from "@/components/ui/button";
import { DropdownMenu } from "@/components/kit/ui/dropdown-menu";
import { Tooltip } from "@/components/kit/ui/tooltip";
import type { MenuItem } from "@/components/kit/ui/types";

const ICON_BUTTON_SIZE = {
  sm: "size-6 rounded-[min(var(--tier0-radius-md),10px)] [&_svg]:size-3",
  md: "size-8 rounded-[4px] [&_svg]:size-4",
  lg: "size-9 rounded-[4px] [&_svg]:size-[18px]",
} as const;

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline";
  active?: boolean;
  danger?: boolean;
  tooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      size = "md",
      variant = "ghost",
      active = false,
      danger = false,
      tooltip = true,
      className,
      disabled,
      ...rest
    },
    ref,
  ) {
    const button = (
      <button
        type="button"
        ref={ref}
        aria-label={label}
        aria-pressed={active || undefined}
        disabled={disabled}
        className={cn(
          "inline-flex shrink-0 items-center justify-center border select-none outline-none",
          "transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "active:scale-[0.92] disabled:pointer-events-none disabled:opacity-50",
          ICON_BUTTON_SIZE[size],
          variant === "outline"
            ? "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
          active && "bg-muted text-foreground hover:bg-muted",
          danger && "text-destructive hover:bg-destructive/10 hover:text-destructive",
          className,
        )}
        {...rest}
      >
        {icon}
      </button>
    );
    if (!tooltip || disabled) return button;
    return <Tooltip title={label}>{button}</Tooltip>;
  },
);

const TEXT_TONE = {
  primary: "text-primary hover:text-primary/80",
  success: "text-success-deep hover:text-success",
  warning: "text-warning-deep hover:text-warning",
  danger: "text-destructive hover:text-destructive/80",
  default: "text-muted-foreground hover:text-foreground",
} as const;

export interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: keyof typeof TEXT_TONE;
  icon?: ReactNode;
  size?: "sm" | "md";
}

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
  function TextButton(
    { tone = "primary", icon, size = "md", className, children, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        type="button"
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] select-none outline-none",
          "transition-[color,text-decoration-color,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
          "underline decoration-transparent underline-offset-4 hover:decoration-current focus-visible:ring-3 focus-visible:ring-ring/50",
          "active:opacity-70",
          size === "sm" ? "text-xs leading-5" : "text-sm leading-5",
          TEXT_TONE[tone],
          "disabled:pointer-events-none disabled:opacity-50 disabled:no-underline",
          className,
        )}
        {...rest}
      >
        {icon ? (
          <span className="flex shrink-0 items-center [&>svg]:size-3.5">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);

export interface SplitButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  menuItems: MenuItem[];
  variant?: "outline" | "primary";
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  menuLabel?: string;
  className?: string;
}

export function SplitButton({
  children,
  icon,
  onClick,
  menuItems,
  variant = "outline",
  size = "md",
  disabled = false,
  loading = false,
  menuLabel = "更多",
  className,
}: SplitButtonProps) {
  return (
    <span className={cn("inline-flex max-w-full items-stretch", className)}>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        loading={loading}
        className="rounded-r-none"
        onClick={onClick}
      >
        {children}
      </Button>
      <DropdownMenu items={menuItems} placement="bottom-end" disabled={disabled}>
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          aria-label={menuLabel}
          className={cn(
            "-ml-px rounded-l-none px-0",
            size === "sm" ? "w-7" : size === "lg" ? "w-9" : "w-8",
            variant === "primary" && "border-l-white/30",
          )}
        >
          <EllipsisVertical className="size-4" />
        </Button>
      </DropdownMenu>
    </span>
  );
}
