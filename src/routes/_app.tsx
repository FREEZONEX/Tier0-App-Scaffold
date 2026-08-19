/**
 * Pathless workspace layout route — wraps management/planning/admin pages with
 * the Shell sidebar.
 *
 * `beforeLoad` runs server-side, reads the Gateway identity headers, and
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
import { TemplatePreviewPlaceholder } from "@/components/TemplatePreviewPlaceholder";
import { RouteError } from "@/components/ui";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { sendPreviewError, sendPreviewReady } from "@/lib/preview-bridge";
import type { AppUser } from "@/lib/users";

const loadGatewayUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

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
    return loadGatewayUser().then((user) => {
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
    sendPreviewReady();
  }, [user]);

  if (!user) {
    return <AppPending />;
  }

  return (
    <div className="template-preview-root">
      <Shell user={user}>
        <Outlet />
      </Shell>
      <TemplatePreviewPlaceholder />
    </div>
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

  return <RouteError error={error} reset={reset} />;
}
