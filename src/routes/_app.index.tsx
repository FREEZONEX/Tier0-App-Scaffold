import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: WorkspaceHome,
});

function WorkspaceHome() {
  return <div className="min-h-full bg-background" />;
}
