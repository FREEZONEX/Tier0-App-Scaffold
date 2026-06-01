#!/usr/bin/env python3
"""Print layout starter snippets for the TanStack Start scaffold."""

from __future__ import annotations

import argparse
import textwrap


SNIPPETS: dict[str, str] = {
    "authenticated-route": r'''
import {
  createFileRoute,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { IntentLayout } from "@/components/layouts/IntentLayout";
import { getCurrentUser } from "@/lib/auth";
import type { AppUser } from "@/lib/users";

const fetchIntentSessionUser = createServerFn().handler(
  async (): Promise<AppUser | null> => getCurrentUser(),
);

export const Route = createFileRoute("/intent")({
  beforeLoad: async ({ location }) => {
    const user = await fetchIntentSessionUser();
    if (!user) {
      throw redirect({ to: "/login", search: { from: location.pathname } });
    }
    return { user };
  },
  component: IntentRouteLayout,
  pendingComponent: IntentPending,
  errorComponent: IntentError,
});

function IntentRouteLayout() {
  const user = (Route.useRouteContext() as { user?: AppUser | null }).user;
  if (!user) return <IntentPending />;
  return (
    <IntentLayout user={user}>
      <Outlet />
    </IntentLayout>
  );
}

function IntentPending() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-highlight" />
        <p className="mt-3 text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function IntentError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="text-center">
        <p className="text-sm font-medium text-destructive">Layout failed</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <button
          type="button"
          className="mt-4 inline-flex h-8 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
''',
    "station-layout": r'''
import { type ReactNode } from "react";
import { Activity, Factory } from "lucide-react";
import type { AppUser } from "@/lib/users";

export function StationLayout({
  user,
  children,
}: {
  user?: AppUser | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-highlight-text">
            <Factory className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-6">Station</p>
            <p className="caption truncate">Task operation</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface-inset px-3 py-2">
          <Activity className="size-4 shrink-0 text-highlight-text" />
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium leading-5">
              {user?.displayName ?? "Loading"}
            </p>
            <p className="font-mono text-xs uppercase text-muted-foreground">
              {user?.role ?? ""}
            </p>
          </div>
        </div>
      </header>
      <main className="page-y-scroll min-h-0 flex-1 bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
''',
    "pda-scan-page": r'''
import { Check, CircleAlert, Search } from "lucide-react";

export function PdaScanPage() {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-[480px] flex-col gap-3 p-3 text-base sm:p-4">
      <header className="rounded-sm border border-border bg-card p-3">
        <p className="font-mono text-xs uppercase text-muted-foreground">
          Current task
        </p>
        <h1 className="mt-1 text-lg font-semibold leading-6 text-foreground">
          Scan material lot
        </h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Line A / Work order WO-1048
        </p>
      </header>

      <form className="flex flex-1 flex-col gap-3">
        <label className="block rounded-sm border border-highlight-bg-primary bg-card p-3">
          <span className="flex items-center gap-2 text-base font-medium">
            <Search className="size-5 text-highlight-text" />
            Lot or container code
          </span>
          <input
            className="mt-3 h-12 w-full rounded-sm border border-input bg-surface-inset px-3 font-mono text-lg outline-none transition focus:border-highlight"
            inputMode="text"
            autoComplete="off"
            placeholder="Scan or enter code"
          />
        </label>

        <div className="rounded-sm border border-border bg-card p-3">
          <p className="text-base font-medium">Expected quantity</p>
          <p className="mt-1 font-mono text-2xl font-semibold leading-8">
            240 EA
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Confirm the label matches before issuing material.
          </p>
        </div>

        <div className="rounded-sm border border-state-paused-border bg-state-paused-bg p-3 text-state-paused-fg">
          <div className="flex gap-2">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <p className="text-base leading-6">
              If the label is damaged, use manual entry and record a reason.
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="mt-auto inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-highlight-bg-primary bg-button-highlight px-4 text-base font-semibold text-accent-foreground transition hover:bg-highlight-bg-accent"
        >
          <Check className="size-5" />
          Confirm scan
        </button>
      </form>
    </section>
  );
}
''',
    "review-layout": r'''
import { type ReactNode } from "react";
import { ClipboardList, ShieldCheck } from "lucide-react";
import type { AppUser } from "@/lib/users";

export function ReviewLayout({
  user,
  children,
}: {
  user?: AppUser | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-state-info-border bg-state-info-bg text-state-info-fg">
            <ClipboardList className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-6">Review</p>
            <p className="caption truncate">Queue and decisions</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface-inset px-3 py-2">
          <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium leading-5">
              {user?.displayName ?? "Loading"}
            </p>
            <p className="font-mono text-xs uppercase text-muted-foreground">
              {user?.role ?? ""}
            </p>
          </div>
        </div>
      </header>
      <main className="page-y-scroll min-h-0 flex-1 bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
''',
    "monitor-layout": r'''
import { type ReactNode } from "react";
import { Activity } from "lucide-react";
import type { AppUser } from "@/lib/users";

export function MonitorLayout({
  user,
  title = "Monitor",
  subtitle = "Live operations board",
  children,
}: {
  user?: AppUser | null;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="monitor-frame flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="monitor-header flex shrink-0 items-center justify-between border-b border-border bg-card">
        <div className="flex min-w-0 items-center gap-3">
          <div className="monitor-header-icon flex shrink-0 items-center justify-center rounded-md border border-highlight-bg-primary bg-highlight-bg-accent text-highlight-text">
            <Activity className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="monitor-header-title truncate font-semibold">
              {title}
            </p>
            <p className="monitor-header-subtitle truncate">{subtitle}</p>
          </div>
        </div>
        <div className="min-w-0 text-right">
          <p className="monitor-header-meta truncate font-mono uppercase text-muted-foreground">
            {user?.role ?? ""}
          </p>
        </div>
      </header>
      <main className="monitor-stage min-h-0 flex-1 overflow-hidden bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
''',
    "monitor-board-page": r'''
import { Activity, AlertTriangle, Clock } from "lucide-react";

const lineStates = [
  { name: "Line A", state: "Running", output: "2,430", tone: "bg-highlight-bg-accent text-highlight-text" },
  { name: "Line B", state: "Blocked", output: "1,120", tone: "bg-state-error-bg text-state-error-fg" },
  { name: "Line C", state: "Changeover", output: "860", tone: "bg-state-paused-bg text-state-paused-fg" },
];

export function MonitorBoardPage() {
  return (
    <section className="monitor-grid">
      <article className="monitor-panel col-span-4 row-span-2 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <p className="monitor-label font-mono uppercase">Plant OEE</p>
          <Activity className="size-5 text-highlight-text" />
        </div>
        <p className="monitor-kpi text-highlight-text">87.4%</p>
        <p className="monitor-text monitor-fit-text text-muted-foreground">
          Target 85.0% / Shift 2
        </p>
      </article>

      <article className="monitor-panel col-span-4 row-span-2 flex flex-col justify-between">
        <p className="monitor-label font-mono uppercase">Open downtime</p>
        <p className="monitor-kpi text-state-error-fg">18m</p>
        <p className="monitor-text monitor-fit-text text-muted-foreground">
          Longest active stop on Line B
        </p>
      </article>

      <article className="monitor-panel col-span-4 row-span-2 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <p className="monitor-label font-mono uppercase">Last update</p>
          <Clock className="size-5 text-muted-foreground" />
        </div>
        <p className="monitor-title font-mono">14:32:08</p>
        <p className="monitor-text monitor-fit-text text-muted-foreground">
          Auto-refresh every 30s
        </p>
      </article>

      <article className="monitor-panel col-span-8 row-span-4">
        <p className="monitor-title">Line Status</p>
        <div className="mt-4 grid h-[calc(100%-2.5rem)] min-h-0 grid-cols-3 gap-[var(--monitor-gap)]">
          {lineStates.map((line) => (
            <div
              key={line.name}
              className={`flex min-h-0 flex-col justify-between rounded-md p-[var(--monitor-panel-pad)] ${line.tone}`}
            >
              <p className="monitor-title monitor-fit-text">{line.name}</p>
              <p className="monitor-kpi">{line.output}</p>
              <p className="monitor-text monitor-fit-text">{line.state}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="monitor-panel col-span-4 row-span-4 border-state-error-border bg-state-error-bg text-state-error-fg">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-6 shrink-0" />
          <p className="monitor-title monitor-fit-text">Active Alerts</p>
        </div>
        <div className="mt-4 space-y-3 overflow-hidden">
          <p className="monitor-text">Line B blocked at packing buffer.</p>
          <p className="monitor-text">Material lot ML-2049 awaiting release.</p>
          <p className="monitor-text">Maintenance response SLA: 07m.</p>
        </div>
      </article>
    </section>
  );
}
''',
    "custom-layout": r'''
import { type ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import type { AppUser } from "@/lib/users";

export function IntentLayout({
  user,
  children,
}: {
  user?: AppUser | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-inset text-muted-foreground">
            <LayoutDashboard className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5">Intent</p>
            <p className="caption truncate">Interaction frame</p>
          </div>
        </div>
        <p className="truncate font-mono text-xs uppercase text-muted-foreground">
          {user?.role ?? ""}
        </p>
      </header>
      <main className="page-y-scroll min-h-0 flex-1 bg-surface-inset">
        {children}
      </main>
    </div>
  );
}
''',
}


def main() -> None:
  parser = argparse.ArgumentParser(description="Print app layout snippets.")
  parser.add_argument("name", help="Snippet name, or 'list'.")
  args = parser.parse_args()

  if args.name == "list":
    print("\n".join(sorted(SNIPPETS)))
    return

  snippet = SNIPPETS.get(args.name)
  if snippet is None:
    choices = ", ".join(sorted(SNIPPETS))
    raise SystemExit(f"Unknown snippet '{args.name}'. Choices: {choices}")

  print(textwrap.dedent(snippet).strip())


if __name__ == "__main__":
  main()
