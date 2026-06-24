import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Router factory.
 *
 * Exported as `getRouter` (the entry name TanStack Start's runtime imports
 * via the `#tanstack-router-entry` alias). Must return a router instance —
 * sync or async.
 */
export const getRouter = () =>
  createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    basepath: (import.meta.env.VITE_BASE_PATH as string | undefined) || undefined,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
