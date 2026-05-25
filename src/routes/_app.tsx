/**
 * Pathless layout route — wraps every authenticated page with the Shell.
 *
 * `beforeLoad` runs server-side, reads the signed session cookie, and
 * places the resolved `AppUser` into the route context. Every nested
 * route can then read it via `Route.useRouteContext()` without an extra
 * client-side fetch (no `/api/auth/me` round-trip after navigation).
 *
 * Loading + error fallbacks are configured here as well — they replace
 * the old Next.js `loading.tsx` / `error.tsx` segment files.
 */

import {
  createFileRoute,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import type { AppUser } from "@/lib/users";

const fetchSessionUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const user = await fetchSessionUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { from: location.pathname },
      });
    }
    return { user };
  },
  component: AppLayout,
  pendingComponent: AppPending,
  errorComponent: AppError,
});

function AppLayout() {
  const user = (Route.useRouteContext() as { user?: AppUser | null }).user;
  if (!user) {
    return <AppPending />;
  }

  return (
    <Shell user={user}>
      <Outlet />
    </Shell>
  );
}

function AppPending() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-highlight" />
        <p className="mt-3 text-xs text-muted-foreground">Loading&hellip;</p>
      </div>
    </div>
  );
}

function AppError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <p className="text-sm font-medium text-destructive">
          Something went wrong
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
