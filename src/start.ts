/**
 * TanStack Start global request middleware — gateway auth + CSRF bridge.
 *
 * All traffic arrives through the UNS-SWE App Gateway, which injects a user
 * identity header for authenticated platform users. The gateway MAY also
 * inject a `role` field (Mode A: gateway-driven role assignment).
 *
 * Flow:
 *   1. Mutating requests (POST/PUT/PATCH/DELETE) must be same-origin —
 *      defense-in-depth against CSRF on top of `sameSite: "lax"` cookie.
 *   2. Public paths (login page, auth endpoints, health/manifest, build assets)
 *      pass through with no auth check.
 *   3. Has mes-session cookie → pass through (already has a session).
 *   4. No cookie + gateway provides a role that's valid in PERMISSION_MATRIX →
 *      auto-issue the session cookie and 302 to the same URL. The next request
 *      runs with the cookie present. The user never sees `/login`.
 *   5. No cookie + gateway has user but no/invalid role → redirect to /login
 *      so the user can pick from PERMISSION_MATRIX.
 *   6. No cookie + no gateway header → 401.
 *
 * This file replaces the Next.js `src/proxy.ts` middleware. DO NOT modify.
 */

import { createMiddleware, createStart } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { parseGatewayUser } from "@/lib/gateway";
import { PERMISSION_MATRIX } from "@/lib/permissions";
import { encodeSession } from "@/lib/session";

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
    if (!gatewayUser) {
      return new Response(
        `<!DOCTYPE html><html><body><script>try{if(window.parent!==window){window.parent.postMessage({type:'tier0.preview.error',error:'Platform authentication required',kind:'auth'},'*')}}catch(e){}</script></body></html>`,
        { status: 401, headers: { "Content-Type": "text/html" } },
      );
    }

    // Mode A: gateway supplied a role, and it is one we know about — mint the
    // session cookie ourselves and bounce back to the original URL. The
    // round-trip is the cost of carrying the freshly-set cookie into a normal
    // request flow; it only happens once per session.
    const validRoles = Object.keys(PERMISSION_MATRIX);
    if (
      gatewayUser.role &&
      validRoles.length > 0 &&
      validRoles.includes(gatewayUser.role)
    ) {
      setCookie(
        SESSION_COOKIE,
        encodeSession({
          userId: gatewayUser.id,
          role: gatewayUser.role,
          username: gatewayUser.name,
          displayName: gatewayUser.name,
          email: gatewayUser.email,
        }),
        {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: SESSION_MAX_AGE,
        },
      );
      return new Response(null, {
        status: 302,
        headers: { Location: request.url },
      });
    }

    // Gateway didn't supply a usable role — fall back to the role-selection page.
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return new Response(null, {
      status: 302,
      headers: { Location: loginUrl.toString() },
    });
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [authBridge],
}));
