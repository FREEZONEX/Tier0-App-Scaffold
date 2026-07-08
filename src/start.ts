/**
 * TanStack Start global request middleware — gateway auth + CSRF bridge.
 *
 * All traffic arrives through the UNS-SWE App Gateway, which injects a user
 * identity header for authenticated platform users. The gateway MAY also
 * inject an active role header.
 *
 * Flow:
 *   1. Mutating requests (POST/PUT/PATCH/DELETE) must be same-origin —
 *      defense-in-depth against CSRF on top of `sameSite: "lax"` cookie.
 *   2. Public paths (login page, auth endpoints, health/manifest, build assets)
 *      pass through with no auth check.
 *   3. If the gateway supplies a valid app role, it is authoritative:
 *      the middleware refreshes `mes-session` when missing or stale and
 *      continues the same request so iframe reloads do not need a second manual refresh.
 *   4. If the gateway supplies an unknown role, fail closed with 403.
 *   5. If no gateway role is present, fall back to the existing session cookie.
 *   6. If there is a gateway user but no role and no session (role not
 *      registered/bound on the platform yet), stay open: issue an admin
 *      fallback session so the preview is not blocked. If the app defines no
 *      admin role, redirect to /login instead.
 *   7. If there is neither gateway identity nor session, return 401.
 */

import { createMiddleware, createStart } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { parseGatewayUser, type GatewayUser } from "@/lib/gateway";
import { ADMIN_ROLE, PERMISSION_MATRIX } from "@/lib/permissions";
import { decodeSession, encodeSession } from "@/lib/session";

const SESSION_COOKIE = "mes-session";

interface SessionPayload {
  userId?: unknown;
  role?: unknown;
  username?: unknown;
  displayName?: unknown;
  email?: unknown;
}

// `pathname === p` (exact) OR `pathname.startsWith(p + "/")` (proper segment).
// Using a slash boundary prevents `/login` from accidentally matching
// `/login-attempts` or other agent-added routes that share a prefix.
const PUBLIC_PATHS = [
  "/login", // role selection page
  "/api/auth", // /api/auth/{me,logout,select-role}
  "/api/health", // health check
  "/api/manifest", // app manifest
  "/favicon.ico", // browser auto-fetch
  "/_build", // vite build assets
  "/__tsr", // tanstack runtime
  "/_server", // tanstack runtime/server internals
  "/_serverFn", // tanstack start server functions
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Same-origin check for CSRF protection.
 * Browsers send `Origin` for all CORS-enabled methods (and modern fetch always).
 * Server-to-server calls (no Origin header) are allowed; same-site cookies
 * (sameSite: "lax") catch the rest.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // not a cross-site browser request
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function matchesDesiredSession(
  rawCookie: string | undefined,
  desired: Required<Pick<SessionPayload, "userId" | "role" | "username" | "displayName" | "email">>,
): boolean {
  const current = decodeSession<SessionPayload>(rawCookie);
  if (!current) {
    return false;
  }

  return current.userId === desired.userId &&
    current.role === desired.role &&
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
  role: string,
): void {
  const desiredSession = {
    userId: gatewayUser.id,
    role,
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

    if (gatewayUser?.role) {
      if (validRoles.length === 0) {
        return jsonError(503, "No roles configured for this app");
      }
      if (!validRoles.includes(gatewayUser.role)) {
        return jsonError(403, `Platform role is not recognized by this app: ${gatewayUser.role}`);
      }

      refreshSessionIfStale(rawSessionCookie, gatewayUser, gatewayUser.role);
      return next();
    }

    if (rawSessionCookie) {
      return next();
    }

    if (gatewayUser) {
      // Gateway identity without a role: the platform has not registered/bound
      // a role yet. Stay open with an admin fallback session instead of
      // blocking the preview behind the role picker.
      if (validRoles.includes(ADMIN_ROLE)) {
        refreshSessionIfStale(rawSessionCookie, gatewayUser, ADMIN_ROLE);
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
