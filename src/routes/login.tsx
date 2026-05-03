/**
 * Role selection page.
 *
 * Gateway has already authenticated the user. This page lets them choose
 * which role to enter the app with. Available roles come from PERMISSION_MATRIX.
 *
 * Lives outside `_app`, so it does NOT render the Shell (mirrors the
 * old Next.js `(auth)` route group behavior).
 *
 * IMPORTANT — why this file does NOT use `createServerFn` to read the
 * gateway user:
 *
 *   1. `getRequestHeaders()` inside a `createServerFn` body is broken in
 *      @tanstack/react-start ^1.167 — returns `{}` for custom headers.
 *      A `loader: () => createServerFn(...)` pattern therefore cannot
 *      surface the gateway-injected `X-App-User-*` identity.
 *   2. Top-level imports from `@tanstack/react-start/server` in a route
 *      file leak into the client bundle and crash hydration with
 *      `does not provide an export named 'getRequest'`. Server-only
 *      imports are only safe inside `createServerFn().handler(...)`.
 *
 * So we read the gateway user via a server route handler
 * (`/api/auth/gateway-user`, see `routes/api/auth/gateway-user.ts`) and
 * fetch it client-side. This file therefore ships ZERO server-only
 * imports — keeping the client bundle clean.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ShieldAlert } from "lucide-react";
import { apiUrl } from "@/lib/utils";
import type { GatewayUser } from "@/lib/gateway";
import { RoleSelector } from "@/components/login-role-selector";

interface LoginContext {
  gatewayUser: GatewayUser | null;
  roles: string[];
}

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    from: z.string().optional(),
  }),
  component: LoginPage,
});

function LoginPage() {
  const { from } = Route.useSearch();
  const redirectTo = from || "/";

  const [ctx, setCtx] = useState<LoginContext | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/auth/gateway-user"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: LoginContext) => {
        if (!cancelled) setCtx(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <AccessDenied message="Could not contact the platform gateway." />;
  }

  if (!ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
          Loading…
        </p>
      </div>
    );
  }

  if (!ctx.gatewayUser) {
    return <AccessDenied message="Please access this app through the platform gateway." />;
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
            MES Console
          </span>
        </div>

        <div className="rounded-md border border-border bg-card p-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Sign in
          </p>
          <h1 className="mt-1 text-lg font-semibold leading-tight">
            Welcome, {ctx.gatewayUser.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a role to continue.
          </p>

          <div className="mt-5">
            <RoleSelector roles={ctx.roles} redirectTo={redirectTo} />
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Authenticated via platform gateway
        </p>
      </div>
    </div>
  );
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-sm bg-[var(--state-error-bg)] text-[var(--state-error-fg)]">
          <ShieldAlert className="size-5" />
        </div>
        <h1 className="text-base font-semibold">Access Denied</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
