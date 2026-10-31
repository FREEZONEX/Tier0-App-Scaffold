/**
 * Readiness of this process, nothing more (contract in artifact.toml). It runs
 * on every wake, so it must stay free of Tier0 and other dependencies.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ status: "ok", timestamp: Date.now() }),
    },
  },
});
