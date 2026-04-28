"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/utils";

export interface PollingResult<T> {
  /** Latest successful response, or null if no response yet. */
  data: T | null;
  /** Last error, or null on success. Cleared on next successful fetch. */
  error: Error | null;
  /** True before the first response (or first error) lands. */
  isLoading: boolean;
  /** Manually re-fire a fetch without waiting for the next interval. */
  refresh: () => void;
}

/**
 * Poll an API endpoint at a regular interval.
 *
 * Includes abort-on-unmount, error tracking, an `enabled` flag, and a manual
 * `refresh()` trigger. If you find yourself reaching for more (mutations,
 * cache, request dedup) — switch to @tanstack/react-query.
 *
 * Usage:
 *   const { data, error, isLoading, refresh } =
 *     usePolling<DashboardStats>("/api/dashboard/stats", 15000);
 */
export function usePolling<T>(
  url: string,
  interval = 15000,
  options: { enabled?: boolean } = {},
): PollingResult<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!enabled) {
      // Clear loading when the consumer disables the poll.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(apiUrl(url), { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
        }
        const json = (await res.json()) as T;
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    const id = setInterval(() => void load(), interval);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [url, interval, enabled, tick]);

  return { data, error, isLoading, refresh };
}
