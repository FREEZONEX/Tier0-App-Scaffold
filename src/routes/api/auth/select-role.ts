/**
 * Role selection endpoint.
 *
 * Called from the login page after the user picks a role.
 * Reads gateway user header for identity, validates the chosen role
 * against PERMISSION_MATRIX, then writes the signed session cookie.
 *
 * Hardening:
 *   - When PERMISSION_MATRIX is empty (Agent has not configured roles yet),
 *     this endpoint refuses with 503. Fail-closed beats silent bypass.
 *   - Cookie is HMAC-signed (see src/lib/session.ts) — clients cannot tamper
 *     with `role` without invalidating the signature.
 */

import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { withErrors, HttpError } from "@/lib/route-handlers";
import { parseGatewayUser } from "@/lib/gateway";
import { PERMISSION_MATRIX } from "@/lib/permissions";
import { encodeSession } from "@/lib/session";

const SESSION_COOKIE = "mes-session";

export const Route = createFileRoute("/api/auth/select-role")({
  server: {
    handlers: {
      POST: withErrors(async ({ request }) => {
        const gatewayUser = parseGatewayUser(request.headers);
        if (!gatewayUser) {
          throw new HttpError(401, "Gateway user header missing");
        }

        let body: { role?: string };
        try {
          body = await request.json();
        } catch {
          throw new HttpError(400, "Invalid request body");
        }

        const role = body.role;
        if (!role) {
          throw new HttpError(400, "Role is required");
        }

        const validRoles = Object.keys(PERMISSION_MATRIX);
        if (validRoles.length === 0) {
          // Fail-closed: an empty matrix would otherwise let any string through.
          throw new HttpError(
            503,
            "No roles configured. Define PERMISSION_MATRIX in src/lib/permissions.ts.",
          );
        }
        if (!validRoles.includes(role)) {
          throw new HttpError(
            400,
            `Invalid role. Available: ${validRoles.join(", ")}`,
          );
        }

        setCookie(
          SESSION_COOKIE,
          encodeSession({
            userId: gatewayUser.id,
            role,
            displayName: gatewayUser.name,
            username: gatewayUser.name,
            email: gatewayUser.email,
          }),
          {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
          },
        );

        return Response.json({
          userId: gatewayUser.id,
          role,
          displayName: gatewayUser.name,
        });
      }),
    },
  },
});
