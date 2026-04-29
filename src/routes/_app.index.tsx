/**
 * Dashboard placeholder (mounted at "/").
 *
 * Agent: replace this entire file with your dashboard implementation.
 * The `user` is already available from the parent `_app` route context —
 * no fetch needed. Use MetricCard, OEEGauge, recharts (wrapped in
 * <ClientOnly>), and other MES components.
 *
 * See AGENTS.md §Visual Style for industrial-UI principles to follow.
 */

import { createFileRoute } from "@tanstack/react-router";
import { Activity, Package, ShieldCheck, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

const PLACEHOLDERS: Array<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { label: "Output (pcs/hr)", icon: Activity },
  { label: "OEE", icon: ShieldCheck },
  { label: "Quality %", icon: Package },
  { label: "Active Orders", icon: ListChecks },
];

function DashboardPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="px-6 py-5">
      {/* Page header */}
      <div className="mb-5 flex items-end justify-between border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-1 text-xl font-semibold leading-tight">
            Production overview
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">{user.displayName}</span>
          {" · "}
          <span className="font-mono uppercase tracking-wide">{user.role}</span>
        </p>
      </div>

      {/* KPI grid placeholder */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDERS.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="rounded-md border border-border bg-card p-3"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-muted-foreground">
              ––
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Awaiting agent build-out
            </p>
          </div>
        ))}
      </div>

      {/* Footer hint for the agent */}
      <p className="mt-6 rounded-md border border-dashed border-border bg-[var(--surface-inset)] px-3 py-2.5 text-[11px] text-muted-foreground">
        <span className="font-mono uppercase tracking-wide text-foreground">
          Hint
        </span>
        {" — "}
        replace this file with your real dashboard. Pull KPIs from your
        services, wrap recharts in <code className="font-mono">&lt;ClientOnly&gt;</code>,
        and use MES components (<code className="font-mono">MetricCard</code>,{" "}
        <code className="font-mono">OEEGauge</code>,{" "}
        <code className="font-mono">DataTable</code>).
      </p>
    </div>
  );
}
