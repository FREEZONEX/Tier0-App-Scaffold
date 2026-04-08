import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema";
import { insertItemSchema, updateItemSchema } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSessionWithAction } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    await requireSessionWithAction("items:read");
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const row = await db
        .select()
        .from(items)
        .where(eq(items.id, id))
        .limit(1);
      if (!row[0])
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(row[0]);
    }
    const rows = await db
      .select()
      .from(items)
      .orderBy(desc(items.updatedAt));
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
    await requireSessionWithAction("items:write");
    const body = insertItemSchema.parse(await req.json());
    const [row] = await db.insert(items).values(body).returning();
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
    await requireSessionWithAction("items:write");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const body = updateItemSchema.parse(await req.json());
    const [row] = await db
      .update(items)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    if (!row)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    await requireSessionWithAction("items:delete");
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const [row] = await db.delete(items).where(eq(items.id, id)).returning();
    if (!row)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; code?: string };
    if (err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err.code === "23503")
      return NextResponse.json(
        { error: "Cannot delete: referenced by other records" },
        { status: 409 },
      );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
