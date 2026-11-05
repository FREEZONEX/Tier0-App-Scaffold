"use client";

import { useEffect, useRef, useState } from "react";

export interface AnimatedNumberProps {
  value: number;
  /** Intl formatting, e.g. `{ maximumFractionDigits: 1 }`. */
  format?: Intl.NumberFormatOptions;
  /** Roll duration in ms. */
  duration?: number;
  className?: string;
}

/**
 * AnimatedNumber — rolls from the previous value to the new one when live
 * data changes (CountUp pattern). The first render prints the real value so
 * SSR and hydration match; only later updates animate. Reduced-motion users
 * see the new value immediately.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 200,
  className,
}: AnimatedNumberProps) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const span = reduce ? 0 : Math.max(0, Math.min(200, duration));
    const start = performance.now();
    const tick = (now: number) => {
      const t = span <= 0 ? 1 : Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      fromRef.current = next;
      setShown(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  const digits = format?.maximumFractionDigits ?? (Number.isInteger(value) ? 0 : 1);
  return (
    <span className={className}>
      {shown.toLocaleString(undefined, { maximumFractionDigits: digits, ...format })}
    </span>
  );
}
