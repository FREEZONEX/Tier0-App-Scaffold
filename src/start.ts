/**
 * TanStack Start global middleware: visitor token verification and CSRF guard.
 *
 * The front door signs the visitor into `X-Tier0-Visitor` on every request, and
 * strips any `X-Tier0-*` the client sent. Failure to verify is always a 401; no
 * plain identity header is read anywhere, and the App has no session cookie.
 *
 * - Pages and API routes need a verified visitor. A `machine` visitor (App call
 *   token) only reaches the paths of `src/lib/webhooks.ts`.
 * - Server functions all arrive on one path, so they are checked per function:
 *   `requireEmployeeFn` demands an employee unless the function opted out
 *   (`src/lib/server-fn-policy.ts`).
 *
 * Every request, public paths included, runs inside the data-layer request
 * context, so platform calls made while serving it forward the front door's
 * `X-Tier0-Delegation`. Backend verifies it and binds it to this App's
 * credential, so the App can neither forge nor widen it. The context gets the
 * request itself, so its abort signal reaches the data layer: when the caller
 * goes away, data calls still queued are dropped and those in flight are
 * cancelled.
 */

import { createMiddleware, createStart } from "@tanstack/react-start";
import { runWithRequestContext } from "@tier0/sdk-v2/data";
import { requireAuth } from "@/lib/auth";
import { isPublicServerFn } from "@/lib/server-fn-policy";
import { readVisitor, visitorReady } from "@/lib/visitor";
import { isWebhookPath } from "@/lib/webhooks";

// Exact path or proper child segment. This avoids `/login-attempts` matching
// the public `/login` prefix. `/_server` and `/_serverFn` pass here because
// `requireEmployeeFn` decides per function.
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

export const authBridge = createMiddleware().server(({ request, pathname, next }) =>
  runWithRequestContext(request, async () => {
    if (MUTATING.has(request.method) && !isSameOrigin(request)) {
      return jsonError(403, "Cross-origin request blocked");
    }

    if (isPublicPath(pathname)) {
      return next();
    }

    // Published Apps fetch the front door keys in the background; the first
    // request waits for that fetch instead of being refused for want of keys.
    await visitorReady();
    let visitor;
    try {
      visitor = readVisitor(request.headers);
    } catch {
      return jsonError(503, "Visitor verification is not configured");
    }
    if (!visitor) {
      return jsonError(401, "Platform authentication required");
    }
    if (visitor.subType === "machine" && !isWebhookPath(pathname)) {
      return jsonError(403, "This path does not accept machine callers");
    }
    return next();
  }),
);

export const requireEmployeeFn = createMiddleware({ type: "function" }).server(
  async ({ serverFnMeta, next }) => {
    if (!isPublicServerFn(serverFnMeta.name)) await requireAuth();
    return next();
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [authBridge],
  functionMiddleware: [requireEmployeeFn],
}));
