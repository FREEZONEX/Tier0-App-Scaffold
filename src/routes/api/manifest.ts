/**
 * App manifest endpoint — declares available roles to the platform.
 *
 * The platform admin UI calls this endpoint to know which roles
 * exist in this app, then presents a dropdown for role assignment.
 *
 * Data source: PERMISSION_MATRIX from permissions.ts.
 * When the Agent adds/removes roles, this endpoint auto-updates.
 *
 * Scaffold-provided. DO NOT modify unless extending manifest capabilities.
 */

import { createFileRoute } from "@tanstack/react-router";
import { PERMISSION_MATRIX, ROLE_LABELS } from "@/lib/permissions";

const APP_ID = process.env.APP_ID || "monoapp";
const DEFAULT_ROLE = "admin";

export const Route = createFileRoute("/api/manifest")({
  server: {
    handlers: {
      GET: async () => {
        const roles = Object.keys(PERMISSION_MATRIX).map((key) => ({
          key,
          label: ROLE_LABELS[key] || key,
        }));

        return Response.json({
          appId: APP_ID,
          roles,
          defaultRole: roles.some((r) => r.key === DEFAULT_ROLE)
            ? DEFAULT_ROLE
            : roles[0]?.key || "admin",
        });
      },
    },
  },
});
