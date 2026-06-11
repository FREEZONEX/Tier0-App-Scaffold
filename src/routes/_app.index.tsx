import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: WorkspaceHomePlaceholder,
});

function WorkspaceHomePlaceholder() {
  return <div className="min-h-full bg-bg" aria-hidden="true" />;
}
