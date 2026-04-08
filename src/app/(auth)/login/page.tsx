/**
 * Role selection page.
 *
 * Gateway has already authenticated the user. This page lets them
 * choose which role to enter the app with. Available roles come from
 * PERMISSION_MATRIX in permissions.ts.
 *
 * If no gateway user header is detected (direct access without gateway),
 * shows an access-denied message.
 */

import { headers } from "next/headers";
import { parseGatewayUser } from "@/lib/gateway";
import { PERMISSION_MATRIX } from "@/lib/permissions";
import { RoleSelector } from "./role-selector";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const headerList = await headers();
  const gatewayUser = parseGatewayUser(headerList);
  const roles = Object.keys(PERMISSION_MATRIX);
  const params = await searchParams;
  const redirectTo = params.from || "/";

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
          <h1 className="text-lg font-semibold">
            Welcome, {gatewayUser.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a role to continue
          </p>
        </div>
        <RoleSelector
          roles={roles}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
