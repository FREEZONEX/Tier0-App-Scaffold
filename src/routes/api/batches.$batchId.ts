import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { editBatchInput, editDraftBatch, getBatch } from "@/services/batches";

export const Route = createFileRoute("/api/batches/$batchId")({
  server: {
    handlers: {
      GET: withErrors(async ({ params }) => {
        const user = await requireAuth();
        return Response.json(await getBatch(user, params.batchId));
      }),
      PATCH: withErrors(async ({ request, params }) => {
        const user = await requireAuth();
        const input = editBatchInput.parse(await request.json());
        return Response.json(await editDraftBatch(user, params.batchId, input));
      }),
    },
  },
});
