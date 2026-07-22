/**
 * Station layout route — for authenticated, task-first workflows under
 * `/station/*`.
 *
 * Use this route group for scan/tap/confirm flows such as receiving,
 * issuing material, production reporting, inspections at capture time, and
 * workstation operations. It deliberately has no sidebar.
 */

import {
  createFileRoute,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StationLayout } from "@/components/layouts/StationLayout";
import { RouteError } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import type { AppUser } from "@/lib/users";

const fetchStationSessionUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

export const Route = createFileRoute("/station")({
  beforeLoad: async ({ location }) => {
    const user = await fetchStationSessionUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { from: location.pathname },
      });
    }
    return { user };
  },
  component: StationRouteLayout,
  pendingComponent: StationPending,
  errorComponent: StationError,
});

function StationRouteLayout() {
  const user = (Route.useRouteContext() as { user?: AppUser | null }).user;
  if (!user) {
    return <StationPending />;
  }

  return (
    <StationLayout user={user}>
      <Outlet />
    </StationLayout>
  );
}

function StationPending() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-highlight" />
        <p className="mt-3 text-xs text-muted-foreground">Loading&hellip;</p>
      </div>
    </div>
  );
}

function StationError({ error, reset }: ErrorComponentProps) {
  return (
    <RouteError title="Station page failed to load" error={error} reset={reset} />
  );
}
