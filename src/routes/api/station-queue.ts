import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { listStationQueue } from "@/services/batches";

export const Route = createFileRoute("/api/station-queue")({
  server: {
    handlers: {
      GET: withErrors(async () => {
        const user = await requireAuth();
        return Response.json(await listStationQueue(user));
      }),
    },
  },
});
