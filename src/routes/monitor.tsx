/**
 * Monitor layout route - for authenticated passive wallboards and fixed
 * large-screen operational displays under `/monitor/*`.
 *
 * Use this route group for andon boards, production TVs, line status boards,
 * OEE displays, and other non-scrolling monitor surfaces. It deliberately has
 * no sidebar, no drawer navigation, and no page-level vertical scrolling.
 */

import {
  createFileRoute,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MonitorLayout } from "@/components/layouts/MonitorLayout";
import { RouteError } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import type { AppUser } from "@/lib/users";

const fetchMonitorSessionUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

export const Route = createFileRoute("/monitor")({
  beforeLoad: async ({ location }) => {
    const user = await fetchMonitorSessionUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { from: location.pathname },
      });
    }
    return { user };
  },
  component: MonitorRouteLayout,
  pendingComponent: MonitorPending,
  errorComponent: MonitorError,
});

function MonitorRouteLayout() {
  const user = (Route.useRouteContext() as { user?: AppUser | null }).user;
  if (!user) {
    return <MonitorPending />;
  }

  return (
    <MonitorLayout user={user}>
      <Outlet />
    </MonitorLayout>
  );
}

function MonitorPending() {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-10">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-highlight" />
        <p className="mt-3 text-xs text-muted-foreground">Loading&hellip;</p>
      </div>
    </div>
  );
}

function MonitorError({ error, reset }: ErrorComponentProps) {
  return (
    <RouteError
      title="Monitor page failed to load"
      error={error}
      reset={reset}
      className="h-screen overflow-hidden bg-background"
    />
  );
}
