"use client";

import { useEffect } from "react";
import { useRouteContext, useRouter, type AnyRouter } from "@tanstack/react-router";
import { onPageRuntime } from "@tier0/sdk-v2/page-runtime";
import type { AppUser } from "@/lib/users";

/** The current visitor as the page knows it. */
export interface VisitorProfile {
  id: string;
  username: string;
  displayName: string;
  primaryRole: string;
  roles: string[];
}

/**
 * The signed-in employee, for showing identity and gating UI: the `user` the
 * layout's `beforeLoad` put in route context, the same object the Shell shows.
 * `visitor` is null only outside the layouts (the login page). Authorization
 * belongs on the server: `requireRole(...)` in the route handler.
 *
 * The roles can change while the page is open (a role is revoked or granted
 * on the platform). `reloadVisitor()` reloads the route context, so the
 * Shell's role line, the navigation and every gate follow the server's
 * current roles together.
 */
export function useVisitor(): { visitor: VisitorProfile | null } {
  const { user } = useRouteContext({ strict: false }) as { user?: AppUser | null };
  return { visitor: user ?? null };
}

const reloads = new Set<() => void>();

/**
 * The server may now see this visitor with other roles: reload the route
 * context. Called when a write is refused with 401/403 (`requestJson`) and
 * when the change stream reconnects after the front door ended it
 * (`useRecordChanges`); the front door ends a visitor's long connections when
 * their roles change.
 */
export function reloadVisitor(): void {
  for (const reload of reloads) reload();
}

/**
 * Re-run the routes' `beforeLoad` on `reloadVisitor()` and on the runtime's
 * `resumed` (it also follows a successful reauthorization). Returns the
 * unsubscribe function.
 */
export function syncVisitor(router: Pick<AnyRouter, "invalidate">): () => void {
  const reload = () => void router.invalidate();
  reloads.add(reload);
  const offResumed = onPageRuntime("resumed", reload);
  return () => {
    reloads.delete(reload);
    offResumed();
  };
}

/** Mounted once, by the root route. */
export function useVisitorSync(): void {
  const router = useRouter();
  useEffect(() => syncVisitor(router), [router]);
}
