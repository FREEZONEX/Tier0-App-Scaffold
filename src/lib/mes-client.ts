"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/utils";
import { can, type Action } from "@/lib/permissions";

export interface SessionUser {
  id: string;
  displayName: string;
  role: string;
}

export function useMe() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  useEffect(() => {
    fetch(apiUrl("/api/auth/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  return user;
}

export function useCan(role: string | undefined, action: Action): boolean {
  if (!role) return false;
  return can(role, action);
}

export async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (j?.error && typeof j.error === "string") return j.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}
