/**
 * Pathless workspace layout route — wraps management/planning/admin pages with
 * the Shell sidebar.
 *
 * `beforeLoad` runs server-side, reads the signed session cookie, and
 * places the resolved `AppUser` into the route context. Every nested
 * route can then read it via `Route.useRouteContext()` without an extra
 * client-side `/api/auth/me` round-trip after navigation.
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
import { useEffect } from "react";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { sendPreviewError, sendPreviewReady } from "@/lib/preview-bridge";
import type { AppUser } from "@/lib/users";

const loadSessionUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

const SESSION_USER_CACHE_TTL_MS = 30_000;
let cachedSessionUser:
  | { user: AppUser | null; expiresAt: number }
  | undefined;

function rememberSessionUser(user: AppUser | null) {
  if (typeof window === "undefined") return;
  cachedSessionUser = {
    user,
    expiresAt: Date.now() + SESSION_USER_CACHE_TTL_MS,
  };
}

function getCachedSessionUser(): AppUser | null | undefined {
  if (typeof window === "undefined") return undefined;
  if (!cachedSessionUser || cachedSessionUser.expiresAt <= Date.now()) {
    return undefined;
  }
  return cachedSessionUser.user;
}

function requireWorkspaceUser(user: AppUser | null, pathname: string) {
  if (!user) {
    throw redirect({
      to: "/login",
      search: { from: pathname },
    });
  }
  return { user };
}

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    const cachedUser = getCachedSessionUser();
    if (cachedUser !== undefined) {
      return requireWorkspaceUser(cachedUser, location.pathname);
    }

    return loadSessionUser().then((user) => {
      rememberSessionUser(user);
      return requireWorkspaceUser(user, location.pathname);
    });
  },
  component: AppLayout,
  pendingComponent: AppPending,
  errorComponent: AppError,
});

function AppLayout() {
  const user = (Route.useRouteContext() as { user?: AppUser | null }).user;

  useEffect(() => {
    rememberSessionUser(user ?? null);
    sendPreviewReady();
  }, [user]);

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
  useEffect(() => {
    sendPreviewError(error.message || 'Page failed to load', 'app');
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <p className="text-sm font-medium text-destructive">Page failed to load</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <button
          type="button"
          className="mt-4 inline-flex h-8 items-center justify-center rounded-sm border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:bg-background hover:shadow-md focus:border-highlight focus:outline-none"
          onClick={reset}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
