/**
 * Gateway user endpoint — exposes the platform-injected user identity to
 * the login page.
 *
 * Why this exists (workaround for a TanStack Start framework bug):
 *
 *   In @tanstack/react-start ^1.167, calling `getRequestHeaders()` or
 *   `getRequest()` from inside a `createServerFn().handler(...)` body
 *   does NOT surface the original request's custom headers (only basic
 *   `accept` / `host` / `user-agent`). Whereas `getCookie()` works fine
 *   in the same pattern. The result: a `loader: () => createServerFn(...)`
 *   pattern cannot read the gateway-injected `X-App-User-*` headers.
 *
 *   Server route handlers (this file) DO receive the raw `Request` with
 *   complete headers via the handler's `{ request }` argument. So we
 *   expose the gateway user via a plain GET endpoint that the login page
 *   fetches client-side.
 *
 * The endpoint is public (covered by `/api/auth` in start.ts PUBLIC_PATHS).
 * It returns the gateway user (or null) plus the configured role list.
 */

import { createFileRoute } from "@tanstack/react-router";
import { withErrors } from "@/lib/route-handlers";
import { parseGatewayUser } from "@/lib/gateway";
import { PERMISSION_MATRIX } from "@/lib/permissions";

export const Route = createFileRoute("/api/auth/gateway-user")({
  server: {
    handlers: {
      GET: withErrors(async ({ request }) => {
        const gatewayUser = parseGatewayUser(request.headers);
        return Response.json({
          gatewayUser,
          roles: Object.keys(PERMISSION_MATRIX),
        });
      }),
    },
  },
});
