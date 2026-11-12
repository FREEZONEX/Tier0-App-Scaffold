import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/station/feed")({
  component: FeedLayout,
});

function FeedLayout() {
  return <Outlet />;
}
