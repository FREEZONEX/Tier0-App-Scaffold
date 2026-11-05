"use client";

import { useEffect, useRef, useState } from "react";

export interface AnimatedNumberProps {
  value: number;
  /**
   * Intl formatting, e.g. `{ maximumFractionDigits: 1 }`. Omit it to print the
   * value at its own precision (`0.04` stays `0.04`); pass it only when the
   * metric has an explicit display rule (currency, percent, fixed decimals).
   */
  format?: Intl.NumberFormatOptions;
  /** Roll duration in ms. */
  duration?: number;
  className?: string;
}

/** Intl accepts at most 100, but beyond 20 digits a float carries no meaning. */
const MAX_FRACTION_DIGITS = 20;

/**
 * Number of decimal places needed to print `n` without rounding it, e.g.
 * `0.04 → 2`, `99.99 → 2`, `12 → 0`, `1.5e-7 → 8`.
 */
export function fractionDigitsOf(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const [mantissa, exponent] = Math.abs(n).toString().split("e");
  const decimals = mantissa.split(".")[1]?.length ?? 0;
  const shift = exponent ? -Number(exponent) : 0;
  return Math.min(MAX_FRACTION_DIGITS, Math.max(0, decimals + shift));
}

/**
 * Formats a (possibly mid-roll) number. `precisionOf` lists the business values
 * whose precision must survive: the roll's start and target. Without an
 * explicit `format`, the shown value keeps the larger of their precisions, so
 * animation never rounds a business value away.
 */
export function formatAnimatedNumber(
  shown: number,
  precisionOf: readonly number[],
  format?: Intl.NumberFormatOptions,
  locale?: string,
): string {
  const minimum = format?.minimumFractionDigits ?? 0;
  const maximum =
    format?.maximumFractionDigits ??
    Math.max(minimum, ...precisionOf.map(fractionDigitsOf));
  return shown.toLocaleString(locale, {
    ...format,
    maximumFractionDigits: maximum,
  });
}

/**
 * AnimatedNumber — rolls from the previous value to the new one when live
 * data changes (CountUp pattern). The first render prints the real value so
 * SSR and hydration match; only later updates animate, and the last frame is
 * the exact new value. Reduced-motion users see the new value immediately.
 * Display precision follows the values themselves unless `format` says
 * otherwise — the animation never changes a business number.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 200,
  className,
}: AnimatedNumberProps) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  /** Last business value (prop), never a mid-roll float. */
  const targetRef = useRef(value);
  /** Business value the roll in flight left; its precision holds until landing. */
  const [rollStart, setRollStart] = useState(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const previousTarget = targetRef.current;
    targetRef.current = value;
    if (from === value) return;
    setRollStart(previousTarget);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const span = reduce ? 0 : Math.max(0, Math.min(200, duration));
    const start = performance.now();
    const tick = (now: number) => {
      const t = span <= 0 ? 1 : Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - t, 3);
      // Land on the exact value: `from + (value - from)` can drift in floats.
      const next = t >= 1 ? value : from + (value - from) * eased;
      fromRef.current = next;
      setShown(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else setRollStart(value);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {formatAnimatedNumber(shown, [rollStart, value], format)}
    </span>
  );
}
