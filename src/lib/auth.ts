import { getRequestHeaders } from "@tanstack/react-start/server";
import type { AppUser } from "./users";
import {
  getGatewayRoles,
  getGatewayRuntime,
  getTrustedGatewayRoles,
  parseGatewayUser,
  type GatewayUser,
} from "./gateway";
import { HttpError } from "./route-handlers";
import {
  ADMIN_ROLE,
  hasAnyRole,
  PERMISSION_MATRIX,
  toRoleList,
} from "./permissions";

function isValidRole(role: string | undefined): role is string {
  return typeof role === "string" &&
    Object.prototype.hasOwnProperty.call(PERMISSION_MATRIX, role);
}

function toAppUser(gatewayUser: GatewayUser, roles: readonly string[]): AppUser {
  const username = gatewayUser.name || gatewayUser.id;
  const normalizedRoles = toRoleList(roles);
  return {
    id: gatewayUser.id,
    username,
    displayName: gatewayUser.name || username,
    primaryRole: normalizedRoles[0] ?? "",
    roles: normalizedRoles,
    email: gatewayUser.email || undefined,
  };
}

/**
 * Read the current user only from Tier0 Gateway headers. In deployed mode,
 * `X-Tier0-Business-Roles` is the complete assigned-role set and effective
 * permissions are its union.
 *
 * Preview intentionally remains single-role "view as". A preview identity
 * without a selected role may use the built-in admin fallback so a fresh app
 * stays open before role registration, without creating an App-owned session.
 * An explicit deployed empty role list never receives that fallback: it enters
 * with zero permissions.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const headers = new Headers(getRequestHeaders());
  const gatewayUser = parseGatewayUser(headers);
  const runtime = getGatewayRuntime(headers);

  const trustedRoles = getTrustedGatewayRoles(headers);
  if (gatewayUser?.id && trustedRoles !== undefined) {
    return toAppUser(gatewayUser, trustedRoles);
  }

  // Legacy role sources are not gateway-stripped, so they remain matrix-gated.
  if (
    gatewayUser?.id &&
    gatewayUser.role &&
    isValidRole(gatewayUser.role)
  ) {
    return toAppUser(gatewayUser, getGatewayRoles(headers));
  }

  if (
    gatewayUser?.id &&
    runtime === "preview" &&
    isValidRole(ADMIN_ROLE)
  ) {
    return toAppUser(gatewayUser, [ADMIN_ROLE]);
  }

  return null;
}

/**
 * Require an authenticated user and, optionally, at least one required role.
 * Multiple assigned roles use union semantics: any matching role is enough.
 */
export async function requireAuth(...roles: string[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  if (roles.length > 0 && !hasAnyRole(user.roles, roles)) {
    throw new HttpError(403, `Requires role: ${roles.join(" or ")}`);
  }
  return user;
}
