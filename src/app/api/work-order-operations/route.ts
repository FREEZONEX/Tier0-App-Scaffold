import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workOrderOperations } from "@/db/schema";
import {
  insertWorkOrderOperationSchema,
  updateWorkOrderOperationSchema,
} from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireSessionWithAction } from "@/lib/api-auth";
import { isValidTransition, recalcWorkOrderTotals } from "@/lib/server-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireSessionWithAction("operations:read");
    const id = req.nextUrl.searchParams.get("id");
    const workOrderId = req.nextUrl.searchParams.get("workOrderId");
    if (id) {
      const row = await db
        .select()
        .from(workOrderOperations)
        .where(eq(workOrderOperations.id, id))
        .limit(1);
      if (!row[0])
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(row[0]);
    }
    if (!workOrderId)
      return NextResponse.json(
        { error: "workOrderId required for list" },
        { status: 400 },
      );
    const rows = await db
      .select()
      .from(workOrderOperations)
      .where(eq(workOrderOperations.workOrderId, workOrderId))
      .orderBy(asc(workOrderOperations.sequence));
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
    await requireSessionWithAction("operations:write");
    const body = insertWorkOrderOperationSchema.parse(await req.json());
    const dup = await db
      .select()
      .from(workOrderOperations)
      .where(
        and(
          eq(workOrderOperations.workOrderId, body.workOrderId),
          eq(workOrderOperations.sequence, body.sequence),
        ),
      )
      .limit(1);
    if (dup[0]) {
      return NextResponse.json(
        { error: "Sequence already exists for this work order" },
        { status: 409 },
      );
    }
    const [row] = await db.insert(workOrderOperations).values(body).returning();
    await recalcWorkOrderTotals(body.workOrderId);
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
    await requireSessionWithAction("operations:write");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await db
      .select()
      .from(workOrderOperations)
      .where(eq(workOrderOperations.id, id))
      .limit(1);
    if (!existing[0])
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = updateWorkOrderOperationSchema.parse(await req.json());
    if (
      body.status &&
      !isValidTransition("operation", existing[0].status, body.status)
    ) {
      return NextResponse.json(
        { error: `Invalid status transition: ${existing[0].status} → ${body.status}` },
        { status: 409 },
      );
    }
    let completedQty = body.completedQty ?? existing[0].completedQty;
    if (body.status === "DONE" && body.completedQty === undefined) {
      completedQty = existing[0].plannedQty;
    }
    const [row] = await db
      .update(workOrderOperations)
      .set({
        ...body,
        completedQty,
        updatedAt: new Date(),
      })
      .where(eq(workOrderOperations.id, id))
      .returning();
    if (row) await recalcWorkOrderTotals(row.workOrderId);
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
    await requireSessionWithAction("operations:write");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await db
      .select()
      .from(workOrderOperations)
      .where(eq(workOrderOperations.id, id))
      .limit(1);
    if (!existing[0])
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.delete(workOrderOperations).where(eq(workOrderOperations.id, id));
    await recalcWorkOrderTotals(existing[0].workOrderId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
