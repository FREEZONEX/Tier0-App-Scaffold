import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ─── Agent: replace this entire page with your dashboard ───
// Use Server Component data fetching (db.select), MetricCard, OEEGauge,
// recharts (wrapped in ResponsiveContainer), and other MES components.
// See AGENTS.md §Rich UI and §Dashboard for requirements.

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Manufacturing execution overview
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
