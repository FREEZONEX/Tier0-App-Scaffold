/**
 * App manifest endpoint — declares available roles for diagnostics.
 *
 * Role registration itself flows through root `roles.json` (read by the
 * platform on import/fork) or the builder's `sync_business_roles` tool — the
 * platform does not discover roles from this endpoint. It remains a cheap,
 * always-current view of the app's role surface for debugging and tooling.
 *
 * Data source: PERMISSION_MATRIX from permissions.ts.
 * When the Agent adds/removes roles, this endpoint auto-updates.
 *
 * Scaffold-provided. DO NOT modify unless extending manifest capabilities.
 */

import { createFileRoute } from "@tanstack/react-router";
import { PERMISSION_MATRIX, ROLE_LABELS } from "@/lib/permissions";

const APP_ID = process.env.APP_ID || "monoapp";

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
          defaultRole: roles[0]?.key ?? null,
        });
      },
    },
  },
});
