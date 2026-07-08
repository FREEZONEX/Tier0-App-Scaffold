import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import type { AppUser } from "./users";
import { parseGatewayUser } from "./gateway";
import { decodeSession } from "./session";
import { HttpError } from "./route-handlers";
import { PERMISSION_MATRIX } from "./permissions";

const SESSION_COOKIE = "mes-session";

interface SessionPayload {
  userId?: unknown;
  role?: unknown;
  username?: unknown;
  displayName?: unknown;
  email?: unknown;
}

function isValidRole(role: string | undefined): role is string {
  return typeof role === "string" && Object.prototype.hasOwnProperty.call(PERMISSION_MATRIX, role);
}

/**
 * Read the current user from the gateway headers first, then the signed session
 * cookie as fallback.
 *
 * Returns null if no valid authenticated identity exists.
 *
 * Async signature is intentional — keeps the API forward-compatible with a
 * future DB-backed session lookup without breaking call sites.
 *
 * Must only be called inside server-route handlers, server functions,
 * or request middleware — never from client components.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const gatewayUser = parseGatewayUser(new Headers(getRequestHeaders()));
  if (gatewayUser?.id && isValidRole(gatewayUser.role)) {
    const username = gatewayUser.name || gatewayUser.id;
    return {
      id: gatewayUser.id,
      username,
      displayName: gatewayUser.name || username,
      role: gatewayUser.role,
      email: gatewayUser.email || undefined,
    };
  }

  const raw = getCookie(SESSION_COOKIE);
  const session = decodeSession<SessionPayload>(raw);
  if (!session) return null;

  const userId = typeof session.userId === "string" ? session.userId : null;
  const role = typeof session.role === "string" ? session.role : null;
  if (!userId || !role) return null;

  const username =
    typeof session.username === "string" ? session.username : userId;
  const displayName =
    typeof session.displayName === "string" ? session.displayName : username;
  const email = typeof session.email === "string" ? session.email : undefined;

  return { id: userId, username, displayName, role, email };
}

/**
 * Require that the current request is authenticated.
 * Optionally restrict to specific roles.
 * Throws HttpError on failure — caught by `withErrors`.
 */
export async function requireAuth(...roles: string[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new HttpError(403, `Requires role: ${roles.join(" or ")}`);
  }
  return user;
}
