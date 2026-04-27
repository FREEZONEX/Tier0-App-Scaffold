/**
 * Current user endpoint — returns session user info.
 * Used by Shell and frontend components to display user identity and role.
 */

import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async () => {
        const user = await getCurrentUser();
        if (!user) {
          return Response.json({ error: "Not authenticated" }, { status: 401 });
        }
        return Response.json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          email: user.email,
        });
      },
    },
  },
});
