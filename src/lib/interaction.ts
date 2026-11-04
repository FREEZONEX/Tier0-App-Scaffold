/**
 * Shared interaction recipes for Wave-0 control polish.
 * Keep brand color / type / radius tokens elsewhere; this file only owns
 * motion, focus, press, and elevation class fragments reused by primitives.
 */

/** Keyboard focus ring — highlight-tinted, never a hard black outline. */
export const FOCUS_RING =
  "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35";

/** Icon / compact controls use a tighter ring. */
export const FOCUS_RING_COMPACT =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background";

/** Soft press feedback for clickable surfaces (skip on links / menus with aria-haspopup). */
export const PRESS_NUDGE =
  "active:not-aria-[haspopup]:scale-[0.97] active:not-aria-[haspopup]:brightness-[0.98]";

/** Default control transition: color + elevation + transform. */
export const TRANSITION_CONTROL =
  "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease)]";

/** Overlay / panel surface transition. */
export const TRANSITION_OVERLAY =
  "transition-[opacity,transform,box-shadow] duration-[var(--motion-base)] ease-[var(--motion-ease)]";

/** Enter animation for centered dialogs / popovers. */
export const ENTER_POP = "animate-[tier0-pop_180ms_var(--motion-ease)]";

/** Enter animation for backdrops. */
export const ENTER_FADE = "animate-[tier0-fade_160ms_ease-out]";

/** Enter animation for left drawers / mobile nav. */
export const ENTER_DRAWER_LEFT =
  "animate-[tier0-drawer-left_220ms_var(--motion-ease)]";

/** Enter animation for right drawers. */
export const ENTER_DRAWER_RIGHT =
  "animate-[tier0-drawer-right_220ms_var(--motion-ease)]";

/**
 * Exit recipes — pair with usePresence() from "@/lib/presence", which keeps the
 * layer mounted and sets data-state="closed" for EXIT_MS before unmounting.
 * `pointer-events-none` stops a fading layer from swallowing clicks.
 */
export const EXIT_FADE =
  "data-[state=closed]:pointer-events-none data-[state=closed]:animate-[tier0-fade-out_160ms_ease-in_forwards]";

export const EXIT_POP =
  "data-[state=closed]:pointer-events-none data-[state=closed]:animate-[tier0-pop-out_160ms_var(--motion-ease)_forwards]";

/** Faster exit for small floating panels (menus, selects, tooltips). */
export const EXIT_POP_FAST =
  "data-[state=closed]:pointer-events-none data-[state=closed]:animate-[tier0-pop-out_120ms_ease-in_forwards]";

export const EXIT_DRAWER_LEFT =
  "data-[state=closed]:pointer-events-none data-[state=closed]:animate-[tier0-drawer-left-out_200ms_var(--motion-ease)_forwards]";

export const EXIT_DRAWER_RIGHT =
  "data-[state=closed]:pointer-events-none data-[state=closed]:animate-[tier0-drawer-right-out_200ms_var(--motion-ease)_forwards]";

/** Bottom sheet for phones (drawers become sheets below sm). */
export const ENTER_SHEET_UP = "animate-[tier0-sheet-up_240ms_var(--motion-spring)]";

/** Stagger children: set `style={{ "--i": index }}` on each child. */
export const STAGGER_ITEM =
  "animate-[tier0-rise_260ms_var(--motion-spring)_both] [animation-delay:calc(var(--i,0)*40ms)]";

/** Soft rise for cards / list sections. */
export const ENTER_RISE = "animate-[tier0-rise_220ms_var(--motion-spring)]";

/** Skeleton shimmer surface — mid highlight stays low-contrast in dark. */
export const SKELETON_SHIMMER =
  "relative overflow-hidden bg-[linear-gradient(90deg,var(--tier0-skeleton-base)_0%,var(--tier0-skeleton-shine)_45%,var(--tier0-skeleton-base)_100%)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]";

/** Raised interactive card surface. */
export const SURFACE_CARD =
  "rounded-[4px] bg-card text-card-foreground ring-1 ring-foreground/10 transition-[box-shadow,ring-color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)]";

/** Hover elevation for clickable cards. */
export const SURFACE_CARD_HOVER =
  "hover:ring-foreground/20 hover:shadow-sm";
