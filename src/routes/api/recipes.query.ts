import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import type { QueryRequest } from "@/lib/component-kit/types";
import { queryRecipes } from "@/services/recipes";

const queryRequest = z.looseObject({});

export const Route = createFileRoute("/api/recipes/query")({
  server: {
    handlers: {
      // Read-only list query (MetaListPage `meta/query`); POST carries the filter body.
      POST: withErrors(async ({ request }) => {
        const user = await requireAuth();
        const body = queryRequest.parse(await request.json()) as QueryRequest;
        return Response.json(await queryRecipes(user, body));
      }),
    },
  },
});
