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
import { getRoleMetadata, type RoleMetadata } from "@/lib/role-metadata";
import { RoleSelector } from "@/components/login-role-selector";

type LoginRoleOption = RoleMetadata & { key: string };

const fetchLoginContext = createServerFn().handler(
  async (): Promise<{
    gatewayUser: GatewayUser | null;
    roles: LoginRoleOption[];
  }> => {
    // `getRequestHeaders()` returns a Headers instance (typed). The Headers
    // constructor accepts another Headers iterable, so passing it through
    // re-creates a normal Headers we hand to `parseGatewayUser`.
    const headers = new Headers(getRequestHeaders());
    return {
      gatewayUser: parseGatewayUser(headers),
      roles: Object.keys(PERMISSION_MATRIX).map((key) => ({
        key,
        ...getRoleMetadata(key),
      })),
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
        <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-md bg-state-error-bg text-state-error-fg">
            <ShieldAlert className="size-5" />
          </div>
          <h1 className="text-base font-semibold">无法访问</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            请通过平台入口访问当前应用。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        {/* Brand bar */}
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-highlight-text">
            <span className="font-mono text-xs font-semibold">M</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">
            制造应用
          </span>
        </div>

        <div className="rounded-md border border-border bg-card p-6 shadow-sm">
          <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
            选择入口
          </p>
          <h1 className="mt-1 text-lg font-semibold leading-tight">
            {gatewayUser.name}，你好
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            选择入口继续。
          </p>

          <div className="mt-5">
            <RoleSelector roles={roles} redirectTo={redirectTo} />
          </div>
        </div>

        <p className="mt-4 text-center text-xs uppercase text-muted-foreground">
          已通过平台网关认证
        </p>
      </div>
    </div>
  );
}
