"use client";

/** ViewIcon — the 5 colored document icons of views (深色 / 绿 / 蓝 / 橙 / 红). */
import type { ViewIcon as ViewIconName } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

const COLORS: Record<ViewIconName, string> = {
  dark: "#1f2329",
  green: "#00b96b",
  blue: "#050b14",
  orange: "#9a3412",
  red: "#b91c1c",
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
      className={cn("shrink-0", className)}
    >
      <rect x="2" y="1" width="12" height="14" rx="2.2" fill={color} />
      <path d="M5 5.2h6M5 8h6M5 10.8h3.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
