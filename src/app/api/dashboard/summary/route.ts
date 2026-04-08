import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  workOrders,
  qualityEvents,
  equipment,
  inventoryLots,
} from "@/db/schema";
import { sql, gte, desc } from "drizzle-orm";
import { requireSessionWithAction } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireSessionWithAction("view_dashboard");

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const [woAgg] = await db
      .select({
        active: sql<number>`count(*) filter (where ${workOrders.status} in ('RELEASED','IN_PROGRESS','ON_HOLD'))::int`,
        completed: sql<number>`count(*) filter (where ${workOrders.status} = 'COMPLETED')::int`,
      })
      .from(workOrders);

    const [qeAgg] = await db
      .select({
        open: sql<number>`count(*) filter (where ${qualityEvents.status} != 'CLOSED')::int`,
      })
      .from(qualityEvents);

    const [eqOee] = await db
      .select({
        a: sql<number>`coalesce(avg(${equipment.availabilityPct}), 0)`,
        p: sql<number>`coalesce(avg(${equipment.performancePct}), 0)`,
        q: sql<number>`coalesce(avg(${equipment.qualityPct}), 0)`,
      })
      .from(equipment);

    const [inv] = await db
      .select({
        totalQty: sql<number>`coalesce(sum(${inventoryLots.qtyOnHand}) filter (where ${inventoryLots.status} = 'AVAILABLE'), 0)::int`,
      })
      .from(inventoryLots);

    const woByStatus = await db
      .select({
        status: workOrders.status,
        c: sql<number>`count(*)::int`,
      })
      .from(workOrders)
      .groupBy(workOrders.status);

    const recentQe = await db
      .select({
        id: qualityEvents.id,
        defectType: qualityEvents.defectType,
        qtyAffected: qualityEvents.qtyAffected,
        status: qualityEvents.status,
        reportedAt: qualityEvents.reportedAt,
      })
      .from(qualityEvents)
      .where(gte(qualityEvents.reportedAt, twoWeeksAgo))
      .orderBy(desc(qualityEvents.reportedAt))
      .limit(8);

    return NextResponse.json({
      workOrders: {
        active: woAgg?.active ?? 0,
        completed: woAgg?.completed ?? 0,
        byStatus: woByStatus.map((r) => ({
          status: r.status,
          count: Number(r.c),
        })),
      },
      quality: { openEvents: qeAgg?.open ?? 0, recent: recentQe },
      oee: {
        availability: Math.round(Number(eqOee?.a ?? 0)),
        performance: Math.round(Number(eqOee?.p ?? 0)),
        quality: Math.round(Number(eqOee?.q ?? 0)),
      },
      inventory: { availableQty: inv?.totalQty ?? 0 },
    });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
