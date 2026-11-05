import { useEffect, useState } from "react";

export type PresenceState = "open" | "closed";

/** Exit durations (ms) kept in step with the EXIT_* recipes in interaction.ts. */
export const EXIT_MS = {
  fast: 120,
  base: 160,
  drawer: 200,
} as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * usePresence — keeps a closing layer mounted long enough to play its exit
 * animation. `state` drives `data-state` so CSS owns the motion; `mounted`
 * decides whether to render at all. Reduced-motion users unmount instantly.
 *
 *   const { mounted, state } = usePresence(open, EXIT_MS.base);
 *   if (!mounted) return null;
 *   return <div data-state={state} className={cn(ENTER_POP, EXIT_POP)} />;
 */
export function usePresence(open: boolean, exitMs: number = EXIT_MS.base) {
  const [mounted, setMounted] = useState(open);

  // Mount synchronously on open so the enter animation starts on first paint.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(
      () => setMounted(false),
      prefersReducedMotion() ? 0 : exitMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, mounted, exitMs]);

  return {
    mounted: open || mounted,
    state: (open ? "open" : "closed") as PresenceState,
  };
}
