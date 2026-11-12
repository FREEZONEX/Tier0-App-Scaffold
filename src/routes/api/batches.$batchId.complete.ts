import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { completeBatch, completeInput } from "@/services/batches";

export const Route = createFileRoute("/api/batches/$batchId/complete")({
  server: {
    handlers: {
      POST: withErrors(async ({ request, params }) => {
        const user = await requireAuth();
        const input = completeInput.parse(await request.json());
        return Response.json(await completeBatch(user, params.batchId, input));
      }),
    },
  },
});
