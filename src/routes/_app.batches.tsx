import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/batches")({
  component: BatchesLayout,
});

function BatchesLayout() {
  return <Outlet />;
}
