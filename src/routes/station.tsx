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
  Link,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ClipboardList } from "lucide-react";
import { APP_NAME } from "@/lib/app-chrome";
import { StationLayout } from "@/components/layouts/StationLayout";
import { RouteErrorBoundary } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { withUserDisplay } from "@/services/user-display";
import type { AppUser } from "@/lib/users";

// Public: it answers null without a visitor, and the route redirects to /login.
const publicServerFnCurrentUser = createServerFn().handler(
  async (): Promise<AppUser | null> => withUserDisplay(await getCurrentUser()),
);

export const Route = createFileRoute("/station")({
  beforeLoad: async ({ location }) => {
    const user = await publicServerFnCurrentUser();
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
    <StationLayout
      user={user}
      title="投料工位"
      subtitle={APP_NAME}
      actions={
        <Link
          to="/batches"
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <ClipboardList className="size-4" aria-hidden="true" />
          批次台账
        </Link>
      }
    >
      <Outlet />
    </StationLayout>
  );
}

function StationPending() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-highlight" />
        <p className="mt-3 text-xs text-muted-foreground">加载中&hellip;</p>
      </div>
    </div>
  );
}

function StationError({ error }: ErrorComponentProps) {
  return <RouteErrorBoundary error={error} scope="station" />;
}
