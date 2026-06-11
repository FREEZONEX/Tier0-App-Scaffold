/**
 * Logout endpoint — clears the session cookie.
 * No product UI currently exposes this action; if called directly, return home.
 */

import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "mes-session";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => {
        deleteCookie(SESSION_COOKIE, { path: "/" });
        return Response.json({ redirect: "/" });
      },
    },
  },
});
