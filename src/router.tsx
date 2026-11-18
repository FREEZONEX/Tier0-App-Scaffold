import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/ui";
import { routeTree } from "./routeTree.gen";

/**
 * Router factory.
 *
 * Exported as `getRouter` (the entry name TanStack Start's runtime imports
 * via the `#tanstack-router-entry` alias). Must return a router instance —
 * sync or async.
 *
 * `defaultErrorComponent` covers every route without its own
 * `errorComponent` (the home page and generated pages under `_app`). Without
 * it a server-rendered loader failure falls back to TanStack's built-in red
 * error box, because child routes do not inherit the parent's boundary. A
 * route's own `errorComponent` still takes precedence.
 */
export const getRouter = () =>
  createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: RouteErrorBoundary,
    basepath:
      (import.meta.env.VITE_BASE_PATH as string | undefined) ||
      (import.meta.env.NEXT_PUBLIC_BASE_PATH as string | undefined) ||
      undefined,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
