import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { equipment } from "@/db/schema";
import { insertEquipmentSchema, updateEquipmentSchema } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSessionWithAction } from "@/lib/api-auth";
import { isValidTransition } from "@/lib/server-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireSessionWithAction("equipment:read");
    const id = req.nextUrl.searchParams.get("id");
    const workCenterId = req.nextUrl.searchParams.get("workCenterId");
    if (id) {
      const row = await db
        .select()
        .from(equipment)
        .where(eq(equipment.id, id))
        .limit(1);
      if (!row[0])
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(row[0]);
    }
    const rows = workCenterId
      ? await db
          .select()
          .from(equipment)
          .where(eq(equipment.workCenterId, workCenterId))
          .orderBy(desc(equipment.updatedAt))
      : await db
          .select()
          .from(equipment)
          .orderBy(desc(equipment.updatedAt));
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
    await requireSessionWithAction("equipment:write");
    const body = insertEquipmentSchema.parse(await req.json());
    const [row] = await db.insert(equipment).values(body).returning();
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
    await requireSessionWithAction("equipment:write");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await db
      .select()
      .from(equipment)
      .where(eq(equipment.id, id))
      .limit(1);
    if (!existing[0])
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = updateEquipmentSchema.parse(await req.json());
    if (
      body.status &&
      !isValidTransition("equipment", existing[0].status, body.status)
    ) {
      return NextResponse.json(
        { error: `Invalid status transition: ${existing[0].status} → ${body.status}` },
        { status: 409 },
      );
    }
    const [row] = await db
      .update(equipment)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(equipment.id, id))
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
    await requireSessionWithAction("equipment:delete");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const [row] = await db.delete(equipment).where(eq(equipment.id, id)).returning();
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
