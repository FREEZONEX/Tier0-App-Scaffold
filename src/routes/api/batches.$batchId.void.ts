import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { voidBatch, voidInput } from "@/services/batches";

export const Route = createFileRoute("/api/batches/$batchId/void")({
  server: {
    handlers: {
      POST: withErrors(async ({ request, params }) => {
        const user = await requireAuth();
        const { reason } = voidInput.parse(await request.json());
        return Response.json(await voidBatch(user, params.batchId, reason));
      }),
    },
  },
});
