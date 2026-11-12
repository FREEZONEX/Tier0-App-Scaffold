import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { releaseBatch } from "@/services/batches";

export const Route = createFileRoute("/api/batches/$batchId/release")({
  server: {
    handlers: {
      POST: withErrors(async ({ params }) => {
        const user = await requireAuth();
        return Response.json(await releaseBatch(user, params.batchId));
      }),
    },
  },
});
