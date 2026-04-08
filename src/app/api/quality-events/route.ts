import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qualityEvents, items, workOrders } from "@/db/schema";
import { insertQualityEventSchema, updateQualityEventSchema } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSessionWithAction } from "@/lib/api-auth";
import { isValidTransition } from "@/lib/server-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireSessionWithAction("quality:read");
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const row = await db
        .select({
          event: qualityEvents,
          itemSku: items.sku,
          itemName: items.name,
          workOrderNumber: workOrders.number,
        })
        .from(qualityEvents)
        .leftJoin(items, eq(qualityEvents.itemId, items.id))
        .leftJoin(workOrders, eq(qualityEvents.workOrderId, workOrders.id))
        .where(eq(qualityEvents.id, id))
        .limit(1);
      if (!row[0])
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(row[0]);
    }
    const rows = await db
      .select({
        event: qualityEvents,
        itemSku: items.sku,
        itemName: items.name,
        workOrderNumber: workOrders.number,
      })
      .from(qualityEvents)
      .leftJoin(items, eq(qualityEvents.itemId, items.id))
      .leftJoin(workOrders, eq(qualityEvents.workOrderId, workOrders.id))
      .orderBy(desc(qualityEvents.reportedAt));
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSessionWithAction("quality:write");
    const body = insertQualityEventSchema.parse(await req.json());
    const [row] = await db.insert(qualityEvents).values(body).returning();
    return NextResponse.json(row);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; issues?: { message: string }[] };
    if (err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err.issues?.[0])
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSessionWithAction("quality:write");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await db
      .select()
      .from(qualityEvents)
      .where(eq(qualityEvents.id, id))
      .limit(1);
    if (!existing[0])
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = updateQualityEventSchema.parse(await req.json());
    if (
      body.status &&
      !isValidTransition("quality_event", existing[0].status, body.status)
    ) {
      return NextResponse.json(
        { error: `Invalid status transition: ${existing[0].status} → ${body.status}` },
        { status: 409 },
      );
    }
    const [row] = await db
      .update(qualityEvents)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(qualityEvents.id, id))
      .returning();
    return NextResponse.json(row);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; issues?: { message: string }[] };
    if (err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err.issues?.[0])
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSessionWithAction("quality:write");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const [row] = await db
      .delete(qualityEvents)
      .where(eq(qualityEvents.id, id))
      .returning();
    if (!row)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
