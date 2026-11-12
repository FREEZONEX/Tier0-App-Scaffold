import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { createBatch, createBatchInput } from "@/services/batches";

export const Route = createFileRoute("/api/batches")({
  server: {
    handlers: {
      POST: withErrors(async ({ request }) => {
        const user = await requireAuth();
        const input = createBatchInput.parse(await request.json());
        return Response.json(await createBatch(user, input), { status: 201 });
      }),
    },
  },
});
