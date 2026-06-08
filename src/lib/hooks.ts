"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/utils";

export interface RequestResult<T> {
  /** Latest successful response, or null if no response yet. */
  data: T | null;
  /** Last error, or null on success. Cleared on next successful fetch. */
  error: Error | null;
  /** True while a request for the current key is in flight. */
  isLoading: boolean;
  /** Manually re-fire a request without changing the request key. */
  refresh: () => void;
}

export type PollingResult<T> = RequestResult<T>;

export interface RequestOptions {
  enabled?: boolean;
  keepPreviousData?: boolean;
}

export interface PollingOptions {
  enabled?: boolean;
  /**
   * Pause interval-driven polling while the document is hidden. The next
   * visible transition triggers a catch-up refresh.
   */
  pauseWhenHidden?: boolean;
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Run a client request keyed by a stable primitive request key.
 *
 * The loader identity is read from a ref so re-renders do not re-trigger the
 * request. Only `requestKey`, `enabled`, or `refresh()` may start a new load.
 * A new request aborts the previous one for the same hook instance.
 *
 * Usage:
 *   const request = useRequest(
 *     `orders:${orderId}`,
 *     async (signal) => {
 *       const res = await fetch(apiUrl(`/api/orders/${orderId}`), { signal });
 *       return (await res.json()) as Order;
 *     },
 *   );
 */
export function useRequest<T>(
  requestKey: string,
  loader: (signal: AbortSignal) => Promise<T>,
  options: RequestOptions = {},
): RequestResult<T> {
  const { enabled = true, keepPreviousData = true } = options;
  const loaderRef = useRef(loader);
  const previousKeyRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    const requestKeyChanged = previousKeyRef.current !== requestKey;
    previousKeyRef.current = requestKey;

    if (!enabled) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    if (requestKeyChanged && !keepPreviousData) {
      setData(null);
    }

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setIsLoading(true);

    let disposed = false;

    void loaderRef.current(controller.signal)
      .then((nextData) => {
        if (
          disposed ||
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }
        setData(nextData);
        setError(null);
      })
      .catch((requestError) => {
        if (
          disposed ||
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(toError(requestError));
      })
      .finally(() => {
        if (disposed || requestId !== requestIdRef.current) {
          return;
        }
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setIsLoading(false);
      });

    return () => {
      disposed = true;
      controller.abort();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [requestKey, enabled, keepPreviousData, refreshToken, loaderRef]);

  return { data, error, isLoading, refresh };
}

/**
 * Poll an API endpoint at a regular interval without overlapping requests.
 *
 * This hook is single-flight: if a request is still running when the next
 * interval arrives, that tick is skipped instead of stacking another fetch.
 * Hidden documents pause interval-driven polling by default, then refresh once
 * the tab becomes visible again.
 *
 * Usage:
 *   const { data, error, isLoading, refresh } =
 *     usePolling<DashboardStats>("/api/dashboard/stats", 15000);
 */
export function usePolling<T>(
  url: string,
  interval = 15000,
  options: PollingOptions = {},
): PollingResult<T> {
  const { enabled = true, pauseWhenHidden = true } = options;
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const loadRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const refresh = useCallback(() => {
    void loadRef.current(true);
  }, []);

  useEffect(() => {
    loadRef.current = async (force = false) => {
      if (!enabled) {
        return;
      }
      if (
        !force &&
        pauseWhenHidden &&
        typeof document !== "undefined" &&
        document.hidden
      ) {
        return;
      }
      if (inFlightRef.current) {
        return;
      }

      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;

      requestIdRef.current = requestId;
      controllerRef.current = controller;
      inFlightRef.current = true;
      setIsLoading(true);

      try {
        const res = await fetch(apiUrl(url), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
        }
        const json = (await res.json()) as T;
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setData(json);
        setError(null);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setError(toError(requestError));
      } finally {
        const isCurrentRequest = requestId === requestIdRef.current;
        if (isCurrentRequest && controllerRef.current === controller) {
          controllerRef.current = null;
          inFlightRef.current = false;
        }
        if (isCurrentRequest && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
  }, [enabled, pauseWhenHidden, url]);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      inFlightRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    void loadRef.current(true);

    const intervalId = window.setInterval(() => {
      void loadRef.current();
    }, interval);

    function handleVisibilityChange() {
      if (document.hidden) {
        return;
      }
      void loadRef.current(true);
    }

    if (pauseWhenHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      window.clearInterval(intervalId);
      if (pauseWhenHidden && typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      inFlightRef.current = false;
    };
  }, [url, interval, enabled, pauseWhenHidden]);

  return { data, error, isLoading, refresh };
}
