/**
 * TanStack Start global request middleware — Gateway auth + CSRF guard.
 *
 * Deployed Tier0 requests carry the user's complete app role assignment in
 * `X-Tier0-Business-Roles`; downstream permission checks compute the union
 * across all roles. The App does not maintain a second session cookie.
 *
 * Preview remains a single-role developer "view as" context. Legacy role
 * headers remain single-role and must match PERMISSION_MATRIX because the
 * Tier0 gateway does not strip/re-inject those headers.
 */

import { createMiddleware, createStart } from "@tanstack/react-start";
import {
  getGatewayRuntime,
  getTrustedGatewayRoles,
  parseGatewayUser,
} from "@/lib/gateway";
import { ADMIN_ROLE, PERMISSION_MATRIX } from "@/lib/permissions";

// Exact path or proper child segment. This avoids `/login-attempts` matching
// the public `/login` prefix.
const PUBLIC_PATHS = [
  "/login",
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

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
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

    const validRoles = Object.keys(PERMISSION_MATRIX);
    const gatewayUser = parseGatewayUser(request.headers);
    const runtime = getGatewayRuntime(request.headers);
    const trustedRoles = getTrustedGatewayRoles(request.headers);

    if (gatewayUser && trustedRoles !== undefined) {
      // The Tier0 gateway strips and re-injects these headers after validating
      // project membership and app role bindings. Unknown roles are therefore
      // trusted identities but contribute zero permissions until configured.
      // A deployed empty list is also authoritative and must stay zero-access.
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

      return next();
    }

    if (gatewayUser && runtime === "preview") {
      // Preview before role registration stays usable without minting an App
      // session. Deployed empty role lists were handled above and never reach
      // this fallback.
      if (validRoles.includes(ADMIN_ROLE)) {
        return next();
      }
      return jsonError(503, "No roles configured for this app");
    }

    if (gatewayUser) {
      return jsonError(403, "Gateway role context missing");
    }

    return jsonError(401, "Platform authentication required");
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [authBridge],
}));
