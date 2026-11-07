"use client";

import { useRequest } from "@/lib/hooks";
import { requestJson } from "@/lib/utils";

/** The current visitor as `/api/auth/me` reports it. */
export interface VisitorProfile {
  id: string;
  username: string;
  displayName: string;
  primaryRole: string;
  roles: string[];
}

/**
 * The signed-in employee, for showing identity and gating UI. Authorization
 * belongs on the server: `requireRole(...)` in the route handler.
 */
export function useVisitor() {
  const { data, error, isLoading } = useRequest("tier0:visitor", (signal) =>
    requestJson<VisitorProfile>("/api/auth/me", { signal }),
  );
  return { visitor: data, error, isLoading };
}
