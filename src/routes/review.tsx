/**
 * Review layout route — for authenticated exception and approval work under
 * `/review/*`.
 *
 * Use this route group when the workflow centers on a queue, evidence, and a
 * decision: quality review, nonconformance disposition, supervisor approval,
 * holds, deviations, or batch exception handling.
 */

import {
  createFileRoute,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ReviewLayout } from "@/components/layouts/ReviewLayout";
import { RouteError } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import type { AppUser } from "@/lib/users";

const fetchReviewSessionUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

export const Route = createFileRoute("/review")({
  beforeLoad: async ({ location }) => {
    const user = await fetchReviewSessionUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { from: location.pathname },
      });
    }
    return { user };
  },
  component: ReviewRouteLayout,
  pendingComponent: ReviewPending,
  errorComponent: ReviewError,
});

function ReviewRouteLayout() {
  const user = (Route.useRouteContext() as { user?: AppUser | null }).user;
  if (!user) {
    return <ReviewPending />;
  }

  return (
    <ReviewLayout user={user}>
      <Outlet />
    </ReviewLayout>
  );
}

function ReviewPending() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-highlight" />
        <p className="mt-3 text-xs text-muted-foreground">Loading&hellip;</p>
      </div>
    </div>
  );
}

function ReviewError({ error, reset }: ErrorComponentProps) {
  return (
    <RouteError title="Review page failed to load" error={error} reset={reset} />
  );
}
