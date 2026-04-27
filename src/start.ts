/**
 * TanStack Start global request middleware — gateway auth + CSRF bridge.
 *
 * All traffic arrives through the UNS-SWE App Gateway, which injects
 * a user identity header for authenticated platform users.
 *
 * Flow:
 *   1. Mutating requests (POST/PUT/PATCH/DELETE) must be same-origin —
 *      defense-in-depth against CSRF on top of `sameSite: "lax"` cookie.
 *   2. Public paths (login page, auth endpoints, health/manifest, build assets)
 *      pass through with no auth check.
 *   3. Has mes-session cookie → pass through (already selected a role).
 *   4. Has gateway user header but no cookie → redirect to /login.
 *   5. Neither → 401 (not a platform user, blocked).
 *
 * This file replaces the Next.js `src/proxy.ts` middleware. DO NOT modify.
 */

import { createMiddleware, createStart } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { parseGatewayUser } from "@/lib/gateway";

const SESSION_COOKIE = "mes-session";

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
  "/_server", // tanstack server functions
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

const authBridge = createMiddleware().server(
  async ({ request, pathname, next }) => {
    if (MUTATING.has(request.method) && !isSameOrigin(request)) {
      return new Response(
        JSON.stringify({ error: "Cross-origin request blocked" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    if (isPublicPath(pathname)) {
      return next();
    }

    if (getCookie(SESSION_COOKIE)) {
      return next();
    }

    const gatewayUser = parseGatewayUser(request.headers);
    if (gatewayUser) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return new Response(null, {
        status: 302,
        headers: { Location: loginUrl.toString() },
      });
    }

    return new Response(
      JSON.stringify({ error: "Platform authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [authBridge],
}));
