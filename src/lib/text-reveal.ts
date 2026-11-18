import { useEffect, useState } from "react";

/** One reveal tick. Every tick grows the transcript and may autoscroll. */
export const REVEAL_TICK_MS = 50;
/** Reading pace: a slower clock carries more text per tick. */
export const REVEAL_CHARS_PER_TICK = 12;
const MIN_TICKS = 40;
const MAX_TICKS = 96;

function revealRate(total: number) {
  const ticks = Math.min(
    MAX_TICKS,
    Math.max(MIN_TICKS, Math.round(total / REVEAL_CHARS_PER_TICK)),
  );
  return Math.max(2, Math.ceil(total / ticks));
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Closes a run the slice cut open at `marker`, so it types in its final style. */
function closeRun(text: string, marker: string) {
  if ((text.split(marker).length - 1) % 2 === 0) return text;
  const open = text.lastIndexOf(marker);
  return open + marker.length < text.length
    ? text + marker
    : text.slice(0, open);
}

/**
 * A half-typed sentence never shows its own markers: open code and bold runs
 * close early, and a cut between the two stars of a marker drops the first.
 */
export function closeIncompleteMarkup(text: string) {
  const whole = /(^|[^*])\*$/.test(text) ? text.slice(0, -1) : text;
  return closeRun(closeRun(whole, "`"), "**");
}

/** Slice `source` to `budget` characters, closing incomplete markdown runs. */
export function sliceRevealedText(source: string, budget: number) {
  if (budget <= 0) return "";
  if (budget >= source.length) return source;
  return closeIncompleteMarkup(source.slice(0, budget));
}

export function shouldSubmitComposerKey(event: {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean };
}): boolean {
  if (event.key !== "Enter" || event.shiftKey) return false;
  const composing =
    event.isComposing ||
    event.keyCode === 229 ||
    Boolean(event.nativeEvent?.isComposing);
  return !composing;
}

/**
 * Gallery / local fake stream: grow `source` at a reading pace.
 * Reduced-motion users get the whole string on the first tick.
 * Pass `active=false` to freeze the current slice (Stop).
 */
export function useSimulatedStream(source: string | null, active: boolean) {
  const [budget, setBudget] = useState(0);

  useEffect(() => {
    if (!source) {
      setBudget(0);
      return;
    }
    if (!active) return;
    if (prefersReducedMotion()) {
      setBudget(source.length);
      return;
    }
    const step = revealRate(source.length);
    setBudget(step);
    const timer = window.setInterval(() => {
      setBudget((current) => {
        if (current >= source.length) {
          window.clearInterval(timer);
          return source.length;
        }
        return Math.min(source.length, current + step);
      });
    }, REVEAL_TICK_MS);
    return () => window.clearInterval(timer);
  }, [source, active]);

  const text = source ? sliceRevealedText(source, budget) : "";
  return {
    text,
    done: Boolean(source) && budget >= (source?.length ?? 0),
  };
}
