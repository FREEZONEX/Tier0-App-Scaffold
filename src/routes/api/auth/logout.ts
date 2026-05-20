/**
 * Logout endpoint — clears the session cookie.
 * User is redirected back to /login to re-select a role.
 */

import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "mes-session";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => {
        deleteCookie(SESSION_COOKIE, { path: "/" });
        return Response.json({ redirect: "/login" });
      },
    },
  },
});
