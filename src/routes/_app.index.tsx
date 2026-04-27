/**
 * Dashboard placeholder (mounted at "/").
 *
 * Agent: replace this entire file with your dashboard implementation.
 * The `user` is already available from the parent `_app` route context —
 * no fetch needed. Use MetricCard, OEEGauge, recharts (wrapped in
 * ResponsiveContainer), and other MES components.
 *
 * See AGENTS.md §Rich UI for the full requirements.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Signed in as{" "}
        <span className="font-medium text-foreground">{user.displayName}</span>{" "}
        ({user.role}). Manufacturing execution overview.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Output", "OEE", "Quality", "Active Orders"].map((label) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">--</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
