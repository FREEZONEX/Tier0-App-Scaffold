import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { recipeInput, updateRecipe } from "@/services/recipes";

const updateRecipeInput = recipeInput.extend({ expectedRevision: z.number().int().min(1) });

export const Route = createFileRoute("/api/recipes/$recipeId")({
  server: {
    handlers: {
      PUT: withErrors(async ({ request, params }) => {
        const user = await requireAuth();
        const { expectedRevision, ...input } = updateRecipeInput.parse(await request.json());
        return Response.json(await updateRecipe(user, params.recipeId, input, expectedRevision));
      }),
    },
  },
});
