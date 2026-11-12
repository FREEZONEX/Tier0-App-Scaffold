import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { feedBatch, feedInput } from "@/services/batches";

export const Route = createFileRoute("/api/batches/$batchId/feed")({
  server: {
    handlers: {
      POST: withErrors(async ({ request, params }) => {
        const user = await requireAuth();
        const input = feedInput.parse(await request.json());
        return Response.json(await feedBatch(user, params.batchId, input));
      }),
    },
  },
});
