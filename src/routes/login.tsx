/**
 * Role selection page.
 *
 * Gateway has already authenticated the user. This page lets them choose
 * which role to enter the app with. Available roles come from PERMISSION_MATRIX.
 *
 * If no gateway user header is detected (direct access without gateway),
 * shows an access-denied message.
 *
 * Lives outside `_app`, so it does NOT render the Shell (mirrors the
 * old Next.js `(auth)` route group behavior).
 *
 * Note on headers: `getRequestHeaders()` returns a `Headers`-like instance
 * (TypedHeaders). Use `.get("name")` for individual values; do NOT try to
 * `JSON.stringify` it for debugging — Headers is iterable, not enumerable,
 * so `JSON.stringify` always returns `"{}"` regardless of content. Inspect
 * with `Object.fromEntries(headers.entries())` instead.
 */

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { ShieldAlert } from "lucide-react";
import { parseGatewayUser, type GatewayUser } from "@/lib/gateway";
import { PERMISSION_MATRIX } from "@/lib/permissions";
import { RoleSelector } from "@/components/login-role-selector";

const fetchLoginContext = createServerFn().handler(
  async (): Promise<{ gatewayUser: GatewayUser | null; roles: string[] }> => {
    // `getRequestHeaders()` returns a Headers instance (typed). The Headers
    // constructor accepts another Headers iterable, so passing it through
    // re-creates a normal Headers we hand to `parseGatewayUser`.
    const headers = new Headers(getRequestHeaders());
    return {
      gatewayUser: parseGatewayUser(headers),
      roles: Object.keys(PERMISSION_MATRIX),
    };
  },
);

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    from: z.string().optional(),
  }),
  loader: () => fetchLoginContext(),
  component: LoginPage,
});

function LoginPage() {
  const { gatewayUser, roles } = Route.useLoaderData();
  const { from } = Route.useSearch();
  const redirectTo = from || "/";

  if (!gatewayUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-sm bg-[var(--state-error-bg)] text-[var(--state-error-fg)]">
            <ShieldAlert className="size-5" />
          </div>
          <h1 className="text-base font-semibold">Access Denied</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Please access this app through the platform gateway.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        {/* Brand bar */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-sm bg-foreground text-background">
            <span className="font-mono text-xs font-semibold">M</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Operations Console
          </span>
        </div>

        <div className="rounded-md border border-border bg-card p-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Sign in
          </p>
          <h1 className="mt-1 text-lg font-semibold leading-tight">
            Welcome, {gatewayUser.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a role to continue.
          </p>

          <div className="mt-5">
            <RoleSelector roles={roles} redirectTo={redirectTo} />
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Authenticated via platform gateway
        </p>
      </div>
    </div>
  );
}
