import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="typo-h3">Home</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Operational workspace entry.
            </p>
          </div>
          <div className="rounded-md border border-border bg-surface-inset px-3 py-2">
            <p className="caption">Current role</p>
            <p className="mt-0.5 font-mono text-xs uppercase text-foreground">
              {user.role}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 sm:px-6">
        <section className="max-w-3xl rounded-md border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold leading-6">Ready</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {user.displayName} is signed in as {user.role}.
          </p>
        </section>
      </main>
    </div>
  );
}
