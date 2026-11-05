"use client";

/** ViewIcon — 5 colored document icons (深色 / 绿 / 蓝 / 橙 / 红). Tokens keep tiles visible in dark. */
import type { ViewIcon as ViewIconName } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

const COLORS: Record<ViewIconName, string> = {
  dark: "var(--view-icon-dark)",
  green: "var(--view-icon-green)",
  blue: "var(--view-icon-blue)",
  orange: "var(--view-icon-orange)",
  red: "var(--view-icon-red)",
};

export interface ViewIconProps {
  icon: ViewIconName | string | null | undefined;
  size?: number;
  className?: string;
}

export function ViewIcon({ icon, size = 16, className }: ViewIconProps) {
  const color = COLORS[(icon as ViewIconName) ?? "dark"] ?? COLORS.dark;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("block size-4 shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <rect x="2" y="1" width="12" height="14" rx="2.2" fill={color} />
      <path
        d="M5 5.2h6M5 8h6M5 10.8h3.6"
        stroke="var(--view-icon-stroke)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
