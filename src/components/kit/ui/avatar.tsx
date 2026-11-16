"use client";

import { useState, type ReactNode } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_SIZE = {
  xs: { box: "size-5 text-xs", icon: "size-3" },
  sm: { box: "size-6 text-xs", icon: "size-3.5" },
  md: { box: "size-8 text-xs", icon: "size-4" },
  lg: { box: "size-10 text-sm", icon: "size-5" },
} as const;

export interface AvatarProps {
  /** Person name; the first character is the fallback. */
  name?: string | null;
  /**
   * Image URL, e.g. a member's `avatarUrl` ("" when the member has none).
   * The initial is shown when it is empty or fails to load.
   */
  src?: string | null;
  size?: keyof typeof AVATAR_SIZE;
  shape?: "circle" | "square";
  title?: string;
  className?: string;
}

export function Avatar({ name, src, size = "md", shape = "circle", title, className }: AvatarProps) {
  // Remember which URL failed, so a new URL (re-queried after expiry) is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const trimmed = name?.trim() ?? "";
  const initial = trimmed ? Array.from(trimmed)[0].toUpperCase() : "";
  const image = src && src !== failedSrc ? src : null;

  return (
    <span
      title={title ?? (trimmed || undefined)}
      aria-label={trimmed || undefined}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-muted font-semibold leading-none text-foreground",
        AVATAR_SIZE[size].box,
        shape === "circle" ? "rounded-full" : "rounded-sm",
        className,
      )}
    >
      {image ? (
        <img
          src={image}
          alt={trimmed}
          className="size-full object-cover"
          // A server-rendered image can fail before hydration attaches onError.
          ref={(node) => {
            if (node?.complete && node.naturalWidth === 0) setFailedSrc(image);
          }}
          onError={() => setFailedSrc(image)}
        />
      ) : initial ? (
        initial
      ) : (
        <User aria-hidden="true" className={AVATAR_SIZE[size].icon} />
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
