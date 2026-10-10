"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonSize } from "@/components/ui/button";
import { DropdownMenu } from "@/components/kit/ui/dropdown-menu";
import { Tooltip } from "@/components/kit/ui/tooltip";
import type { MenuItem } from "@/components/kit/ui/types";

/* ------------------------------------------------------------------ */
/* IconButton                                                           */
/* ------------------------------------------------------------------ */

const ICON_BUTTON_SIZE = { sm: "size-6 rounded-sm [&_svg]:size-3.5", md: "size-8 rounded-md [&_svg]:size-4", lg: "size-10 rounded-lg [&_svg]:size-[18px]" } as const;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  /** Accessible name; also shown as tooltip unless `tooltip={false}`. */
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline";
  /** Pressed / selected look. */
  active?: boolean;
  danger?: boolean;
  tooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = "md", variant = "ghost", active = false, danger = false, tooltip = true, className, disabled, ...rest },
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
        "inline-flex shrink-0 items-center justify-center transition-[color,background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-border",
        ICON_BUTTON_SIZE[size],
        variant === "outline"
          ? "border border-border-strong bg-card text-text-secondary hover:border-brand-hover hover:text-brand-hover"
          : "border border-transparent text-text-secondary hover:bg-fill-hover hover:text-foreground",
        active && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand",
        danger && "text-danger hover:bg-danger-soft hover:text-danger",
        "disabled:cursor-not-allowed disabled:text-text-placeholder disabled:hover:bg-transparent",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
  if (!tooltip || disabled) return button;
  return <Tooltip title={label}>{button}</Tooltip>;
});

/* ------------------------------------------------------------------ */
/* TextButton                                                           */
/* ------------------------------------------------------------------ */

const TEXT_TONE = {
  primary: "text-brand hover:text-brand-hover active:text-brand-active",
  success: "text-success-deep hover:text-success",
  warning: "text-warning-deep hover:text-warning",
  danger: "text-danger hover:text-[#ff7875] active:text-danger-deep",
  default: "text-text-secondary hover:text-brand",
} as const;

export interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary (default, blue) · success · warning · danger (red) · default (gray). */
  tone?: keyof typeof TEXT_TONE;
  icon?: ReactNode;
  size?: "sm" | "md";
}

/** TextButton — borderless colored action (列表行操作「编辑 确认 删除」、工具栏「字段配置」). */
export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(function TextButton(
  { tone = "primary", icon, size = "md", className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      type="button"
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-border",
        size === "sm" ? "text-xs leading-5" : "text-sm leading-[22px]",
        TEXT_TONE[tone],
        "disabled:cursor-not-allowed disabled:text-text-placeholder",
        className,
      )}
      {...rest}
    >
      {icon ? <span className="flex shrink-0 items-center [&>svg]:size-[15px]">{icon}</span> : null}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* SplitButton                                                          */
/* ------------------------------------------------------------------ */

export interface SplitButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  /** Items of the ⋮ menu (e.g. 导入日志). */
  menuItems: MenuItem[];
  variant?: "outline" | "primary";
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  menuLabel?: string;
  className?: string;
}

/** SplitButton — 「导入 | ⋮」 main action with a secondary menu. */
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
            size === "sm" ? "w-6" : size === "lg" ? "w-10" : "w-8",
            variant === "primary" && "border-l-white/40",
          )}
        >
          <EllipsisVertical className="size-4" />
        </Button>
      </DropdownMenu>
    </span>
  );
}
