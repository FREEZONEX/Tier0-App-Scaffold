import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { setRecipeActive } from "@/services/recipes";

const activeInput = z.object({ active: z.boolean() });

export const Route = createFileRoute("/api/recipes/$recipeId/active")({
  server: {
    handlers: {
      POST: withErrors(async ({ request, params }) => {
        const user = await requireAuth();
        const { active } = activeInput.parse(await request.json());
        return Response.json(await setRecipeActive(user, params.recipeId, active));
      }),
    },
  },
});
