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
 */

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { parseGatewayUser, type GatewayUser } from "@/lib/gateway";
import { PERMISSION_MATRIX } from "@/lib/permissions";
import { RoleSelector } from "@/components/login-role-selector";

const fetchLoginContext = createServerFn().handler(
  async (): Promise<{ gatewayUser: GatewayUser | null; roles: string[] }> => {
    const headerEntries = getRequestHeaders();
    const headers = new Headers(headerEntries as Record<string, string>);
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 px-6 text-center">
          <h1 className="text-lg font-semibold">Access Denied</h1>
          <p className="text-xs text-muted-foreground">
            Please access this app through the platform.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 px-6">
        <div>
          <h1 className="text-lg font-semibold">Welcome, {gatewayUser.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a role to continue
          </p>
        </div>
        <RoleSelector roles={roles} redirectTo={redirectTo} />
      </div>
    </div>
  );
}
