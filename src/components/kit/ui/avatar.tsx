"use client";

import type { ReactNode } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["#050b14", "#13a8a8", "#166534", "#fa8c16", "#722ed1", "#eb2f96", "#2f54eb", "#d4a106"];

const AVATAR_SIZE = { xs: 20, sm: 24, md: 32, lg: 40 } as const;

function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export interface AvatarProps {
  /** Person name; the first character is shown. */
  name?: string | null;
  /** Image URL (takes precedence over the initial). */
  src?: string | null;
  size?: keyof typeof AVATAR_SIZE | number;
  shape?: "circle" | "square";
  /** Background color (default derived from the name). */
  color?: string;
  title?: string;
  className?: string;
}

export function Avatar({ name, src, size = "md", shape = "circle", color, title, className }: AvatarProps) {
  const pixels = typeof size === "number" ? size : AVATAR_SIZE[size];
  const trimmed = name?.trim() ?? "";
  const initial = trimmed ? Array.from(trimmed)[0].toUpperCase() : "";
  const background = src ? undefined : initial ? (color ?? colorFor(trimmed)) : "#bfbfbf";

  return (
    <span
      title={title ?? (trimmed || undefined)}
      aria-label={trimmed || undefined}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-medium leading-none text-white",
        shape === "circle" ? "rounded-full" : "rounded-md",
        className,
      )}
      style={{ width: pixels, height: pixels, backgroundColor: background, fontSize: Math.max(10, Math.round(pixels * 0.45)) }}
    >
      {src ? (
        <img src={src} alt={trimmed} className="size-full object-cover" />
      ) : initial ? (
        initial
      ) : (
        <User aria-hidden="true" style={{ width: pixels * 0.56, height: pixels * 0.56 }} />
      )}
    </span>
  );
}

export interface BadgeProps {
  /** Number to show; hidden when 0 unless showZero. */
  count?: number;
  /** Counts above max render as "99+". */
  max?: number;
  /** Small red dot instead of a number. */
  dot?: boolean;
  showZero?: boolean;
  /** Wrapped element; without children the badge renders inline. */
  children?: ReactNode;
  color?: string;
  title?: string;
  className?: string;
}

export function Badge({ count = 0, max = 99, dot = false, showZero = false, children, color, title, className }: BadgeProps) {
  const hidden = !dot && count <= 0 && !showZero;
  const text = count > max ? `${max}+` : String(count);
  const indicator = hidden ? null : (
    <span
      title={title ?? (dot ? undefined : text)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium tabular-nums text-white shadow-[0_0_0_1px_#fff]",
        dot ? "size-1.5" : "h-4 min-w-4 px-1 text-[11px] leading-4",
        children !== undefined && "absolute right-0 top-0 z-10 translate-x-1/2 -translate-y-1/2",
        !color && "bg-danger",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {dot ? null : text}
    </span>
  );

  if (children === undefined) return indicator;
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      {indicator}
    </span>
  );
}
