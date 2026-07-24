/**
 * TanStack Start global request middleware — gateway auth + CSRF bridge.
 *
 * Deployed Tier0 requests carry the user's complete app role assignment in
 * `X-Tier0-Business-Roles`. The signed session caches that complete set and
 * downstream permission checks compute the union across all roles.
 *
 * Preview remains a single-role developer "view as" context. Legacy role
 * headers remain single-role and must match PERMISSION_MATRIX because the
 * Tier0 gateway does not strip/re-inject those headers.
 */

import { createMiddleware, createStart } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import {
  getTrustedGatewayRoles,
  parseGatewayUser,
  type GatewayUser,
} from "@/lib/gateway";
import { ADMIN_ROLE, PERMISSION_MATRIX, toRoleList } from "@/lib/permissions";
import { decodeSession, encodeSession } from "@/lib/session";

const SESSION_COOKIE = "mes-session";

interface SessionPayload {
  userId?: unknown;
  role?: unknown;
  roles?: unknown;
  username?: unknown;
  displayName?: unknown;
  email?: unknown;
}

interface DesiredSession {
  userId: string;
  role: string;
  roles: string[];
  username: string;
  displayName: string;
  email: string;
}

// Exact path or proper child segment. This avoids `/login-attempts` matching
// the public `/login` prefix.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/manifest",
  "/favicon.ico",
  "/_build",
  "/__tsr",
  "/_server",
  "/_serverFn",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function readSessionRoles(session: SessionPayload): string[] {
  const roles = Array.isArray(session.roles)
    ? session.roles.filter((role): role is string => typeof role === "string")
    : [];
  const legacyRole =
    typeof session.role === "string" && session.role ? session.role : null;
  return toRoleList([...(legacyRole ? [legacyRole] : []), ...roles]);
}

function sameRoles(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((role, index) => role === right[index]);
}

function matchesDesiredSession(
  rawCookie: string | undefined,
  desired: DesiredSession,
): boolean {
  const current = decodeSession<SessionPayload>(rawCookie);
  if (!current) {
    return false;
  }

  return current.userId === desired.userId &&
    current.role === desired.role &&
    sameRoles(readSessionRoles(current), desired.roles) &&
    current.username === desired.username &&
    current.displayName === desired.displayName &&
    current.email === desired.email;
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function refreshSessionIfStale(
  rawCookie: string | undefined,
  gatewayUser: GatewayUser,
  roles: readonly string[],
): void {
  const normalizedRoles = toRoleList(roles);
  const desiredSession: DesiredSession = {
    userId: gatewayUser.id,
    role: normalizedRoles[0] ?? "",
    roles: normalizedRoles,
    username: gatewayUser.name,
    displayName: gatewayUser.name,
    email: gatewayUser.email,
  };

  if (matchesDesiredSession(rawCookie, desiredSession)) {
    return;
  }

  setCookie(SESSION_COOKIE, encodeSession(desiredSession), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });
}

const authBridge = createMiddleware().server(
  async ({ request, pathname, next }) => {
    if (MUTATING.has(request.method) && !isSameOrigin(request)) {
      return jsonError(403, "Cross-origin request blocked");
    }

    if (isPublicPath(pathname)) {
      return next();
    }

    const rawSessionCookie = getCookie(SESSION_COOKIE);
    const validRoles = Object.keys(PERMISSION_MATRIX);
    const gatewayUser = parseGatewayUser(request.headers);
    const trustedRoles = getTrustedGatewayRoles(request.headers);

    if (gatewayUser && trustedRoles !== undefined) {
      // The Tier0 gateway strips and re-injects these headers after validating
      // project membership and app role bindings. Unknown roles are therefore
      // trusted identities but contribute zero permissions until configured.
      // A deployed empty list is also authoritative and must stay zero-access.
      refreshSessionIfStale(rawSessionCookie, gatewayUser, trustedRoles);
      return next();
    }

    if (gatewayUser?.role) {
      if (!validRoles.includes(gatewayUser.role)) {
        if (validRoles.length === 0) {
          return jsonError(503, "No roles configured for this app");
        }
        return jsonError(
          403,
          `Platform role is not recognized by this app: ${gatewayUser.role}`,
        );
      }

      refreshSessionIfStale(rawSessionCookie, gatewayUser, [gatewayUser.role]);
      return next();
    }

    if (rawSessionCookie) {
      return next();
    }

    if (gatewayUser) {
      // Preview before role registration stays usable. Deployed empty role
      // lists were already handled above and never reach this fallback.
      if (validRoles.includes(ADMIN_ROLE)) {
        refreshSessionIfStale(rawSessionCookie, gatewayUser, [ADMIN_ROLE]);
        return next();
      }

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return new Response(null, {
        status: 302,
        headers: { Location: loginUrl.toString() },
      });
    }

    return jsonError(401, "Platform authentication required");
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [authBridge],
}));
