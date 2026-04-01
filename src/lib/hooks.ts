"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/utils";

/**
 * Poll an API endpoint at a regular interval.
 * Returns the latest data or null while loading.
 *
 * Usage:
 *   const stats = usePolling<DashboardStats>("/api/dashboard/stats", 15000);
 */
export function usePolling<T>(url: string, interval = 15000) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const load = () => fetch(apiUrl(url)).then((r) => r.json()).then(setData);
    load();
    const id = setInterval(load, interval);
    return () => clearInterval(id);
  }, [url, interval]);
  return data;
}
