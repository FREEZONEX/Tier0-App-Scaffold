import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { createRecipe, listActiveRecipeOptions, recipeInput } from "@/services/recipes";

export const Route = createFileRoute("/api/recipes")({
  server: {
    handlers: {
      GET: withErrors(async () => {
        const user = await requireAuth();
        return Response.json(await listActiveRecipeOptions(user));
      }),
      POST: withErrors(async ({ request }) => {
        const user = await requireAuth();
        const input = recipeInput.parse(await request.json());
        return Response.json(await createRecipe(user, input), { status: 201 });
      }),
    },
  },
});
