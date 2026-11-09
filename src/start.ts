/**
 * TanStack Start global middleware: visitor and CSRF guard.
 *
 * The front door sets `X-Tier0-Visitor` on every request, after stripping any
 * `X-Tier0-*` the client sent. A missing or invalid header is always a 401; no
 * other identity header is read anywhere, and the App has no session cookie.
 *
 * - Pages and API routes need a verified visitor. A `machine` visitor (App call
 *   token) only reaches the paths of `src/lib/webhooks.ts`.
 * - Server functions all arrive on one path, so they are checked per function:
 *   `requireEmployeeFn` demands an employee unless the function opted out
 *   (`src/lib/server-fn-policy.ts`).
 *
 * Every request, public paths included, hands its abort signal to the data
 * layer (`runWithAbortSignal`): when the caller goes away, its data calls still
 * queued are dropped and those in flight are cancelled. Data calls are always
 * the App's own; what the visitor may see is decided by the App's services.
 */

import { createMiddleware, createStart } from "@tanstack/react-start";
import { runWithAbortSignal } from "@tier0/sdk-v2/data";
import { requireAuth } from "@/lib/auth";
import { isPublicServerFn } from "@/lib/server-fn-policy";
import { readVisitor } from "@/lib/visitor";
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
  runWithAbortSignal(request.signal, async () => {
    if (MUTATING.has(request.method) && !isSameOrigin(request)) {
      return jsonError(403, "Cross-origin request blocked");
    }

    if (isPublicPath(pathname)) {
      return next();
    }

    let visitor;
    try {
      visitor = readVisitor(request.headers);
    } catch {
      return jsonError(503, "Visitor identity is not configured");
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
