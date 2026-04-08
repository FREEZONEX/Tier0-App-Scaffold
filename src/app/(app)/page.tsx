"use client";

import { useMemo } from "react";
import { ClipboardList } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import { usePolling } from "@/lib/hooks";
import { MetricCard, OEEGauge, DataTable, TimelineView } from "@/components/mes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StateBadge } from "@/components/mes/StateBadge";
import type { ColumnDef } from "@tanstack/react-table";

type Summary = {
  workOrders: {
    active: number;
    completed: number;
    byStatus: { status: string; count: number }[];
  };
  quality: {
    openEvents: number;
    recent: {
      id: string;
      defectType: string;
      qtyAffected: number;
      status: string;
      reportedAt: string;
    }[];
  };
  oee: { availability: number; performance: number; quality: number };
  inventory: { availableQty: number };
};

export default function DashboardPage() {
  const summary = usePolling<Summary | { error?: string }>(
    "/api/dashboard/summary",
    12000,
  );

  const err =
    summary && "error" in summary && summary.error
      ? summary.error
      : summary && !("workOrders" in summary)
        ? "Unable to load dashboard"
        : null;
  const data = summary && "workOrders" in summary ? summary : null;

  const chartData = useMemo(
    () =>
      (data?.workOrders.byStatus ?? []).map((r) => ({
        name: r.status.replace(/_/g, " "),
        count: r.count,
      })),
    [data],
  );

  const recentQeColumns: ColumnDef<NonNullable<Summary["quality"]["recent"]>[number]>[] =
    useMemo(
      () => [
        {
          accessorKey: "defectType",
          header: "Defect",
        },
        {
          accessorKey: "qtyAffected",
          header: "Qty",
          cell: ({ row }) => (
            <span className="tabular-nums">{row.original.qtyAffected}</span>
          ),
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => (
            <StateBadge state={row.original.status.toLowerCase()} size="sm" />
          ),
        },
        {
          accessorKey: "reportedAt",
          header: "Reported",
          cell: ({ row }) =>
            format(new Date(row.original.reportedAt), "MMM d HH:mm"),
        },
      ],
      [],
    );

  const timelineItems = useMemo(
    () =>
      (data?.quality.recent ?? []).map((r) => ({
        id: r.id,
        timestamp: format(new Date(r.reportedAt), "HH:mm"),
        title: r.defectType,
        description: `${r.qtyAffected} units · ${r.status}`,
        variant: r.status === "CLOSED" ? ("default" as const) : ("warning" as const),
      })),
    [data],
  );

  if (err) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{err}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in with a role that can view the dashboard, or check your database connection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Live production snapshot — updates every few seconds
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active work orders"
          value={data ? String(data.workOrders.active) : "—"}
          icon={ClipboardList}
        />
        <MetricCard
          label="Completed (all time)"
          value={data ? String(data.workOrders.completed) : "—"}
          trend={undefined}
        />
        <MetricCard
          label="Open quality events"
          value={data ? String(data.quality.openEvents) : "—"}
        />
        <MetricCard
          label="Available inventory (qty)"
          value={data ? String(data.inventory.availableQty) : "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Plant OEE (equipment average)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            {data ? (
              <OEEGauge
                availability={data.oee.availability}
                performance={data.oee.performance}
                quality={data.oee.quality}
              />
            ) : (
              <div className="text-xs text-muted-foreground">Loading…</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Work orders by status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground">No work order data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent quality events (14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.quality.recent.length > 0 ? (
              <DataTable
                columns={recentQeColumns}
                data={data.quality.recent}
                searchPlaceholder=""
                pageSize={6}
              />
            ) : (
              <p className="text-xs text-muted-foreground">No recent events.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quality timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineItems.length > 0 ? (
              <TimelineView items={timelineItems} />
            ) : (
              <p className="text-xs text-muted-foreground">No timeline entries.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
