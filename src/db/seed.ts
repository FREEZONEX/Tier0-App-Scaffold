import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const dbSchema = process.env.DB_SCHEMA;

const pool = new Pool({
  connectionString:
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  max: 5,
  ...(dbSchema ? { options: `-csearch_path=${dbSchema}` } : {}),
});
const db = drizzle(pool, { schema });

async function main() {
  console.log("Seeding database...");

  const wcA = "wc-assembly-a1";
  const wcM = "wc-machining-m2";
  const wcP = "wc-pack-p3";

  await db
    .insert(schema.workCenters)
    .values([
      {
        id: wcA,
        code: "WC-ASM-A1",
        name: "Assembly Line A1",
        area: "Building 1 — Floor A",
        status: "ACTIVE",
        createdAt: new Date("2026-03-22T08:00:00"),
        updatedAt: new Date("2026-04-07T10:00:00"),
      },
      {
        id: wcM,
        code: "WC-MACH-M2",
        name: "CNC Cell M2",
        area: "Building 1 — Machining",
        status: "ACTIVE",
        createdAt: new Date("2026-03-20T07:30:00"),
        updatedAt: new Date("2026-04-06T14:20:00"),
      },
      {
        id: wcP,
        code: "WC-PACK-P3",
        name: "Pack & Ship P3",
        area: "Building 2 — Logistics",
        status: "ACTIVE",
        createdAt: new Date("2026-03-25T09:00:00"),
        updatedAt: new Date("2026-04-05T11:00:00"),
      },
    ])
    .onConflictDoUpdate({
      target: schema.workCenters.id,
      set: {
        name: sql`excluded.name`,
        area: sql`excluded.area`,
        status: sql`excluded.status`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  const itPump = "item-hp-100";
  const itValve = "item-vv-55";
  const itBracket = "item-br-12";

  await db
    .insert(schema.items)
    .values([
      {
        id: itPump,
        sku: "HP-100",
        name: "Hydraulic Pump Assembly",
        uom: "EA",
        category: "Finished Good",
        createdAt: new Date("2026-03-18T12:00:00"),
        updatedAt: new Date("2026-04-01T09:00:00"),
      },
      {
        id: itValve,
        sku: "VV-55",
        name: "Proportional Valve",
        uom: "EA",
        category: "Component",
        createdAt: new Date("2026-03-19T10:00:00"),
        updatedAt: new Date("2026-04-02T15:30:00"),
      },
      {
        id: itBracket,
        sku: "BR-12",
        name: "Mounting Bracket 12mm",
        uom: "EA",
        category: "Component",
        createdAt: new Date("2026-03-21T08:00:00"),
        updatedAt: new Date("2026-04-03T11:00:00"),
      },
      {
        id: "item-seal-88",
        sku: "SE-88",
        name: "Seal Kit 88",
        uom: "KIT",
        category: "Consumable",
        createdAt: new Date("2026-03-26T14:00:00"),
        updatedAt: new Date("2026-04-04T09:00:00"),
      },
    ])
    .onConflictDoUpdate({
      target: schema.items.id,
      set: {
        name: sql`excluded.name`,
        uom: sql`excluded.uom`,
        category: sql`excluded.category`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .insert(schema.equipment)
    .values([
      {
        id: "eq-cnc-01",
        code: "CNC-01",
        name: "Vertical Mill 01",
        workCenterId: wcM,
        status: "RUNNING",
        availabilityPct: 91,
        performancePct: 87,
        qualityPct: 99.2,
        createdAt: new Date("2026-03-20T08:00:00"),
        updatedAt: new Date("2026-04-07T06:00:00"),
      },
      {
        id: "eq-cnc-02",
        code: "CNC-02",
        name: "Vertical Mill 02",
        workCenterId: wcM,
        status: "IDLE",
        availabilityPct: 94,
        performancePct: 90,
        qualityPct: 98.5,
        createdAt: new Date("2026-03-20T08:00:00"),
        updatedAt: new Date("2026-04-06T18:00:00"),
      },
      {
        id: "eq-press-a",
        code: "PRESS-A",
        name: "Hydraulic Press A",
        workCenterId: wcA,
        status: "RUNNING",
        availabilityPct: 88,
        performancePct: 85,
        qualityPct: 99.0,
        createdAt: new Date("2026-03-22T09:00:00"),
        updatedAt: new Date("2026-04-07T07:30:00"),
      },
      {
        id: "eq-conveyor-p",
        code: "CONV-P3",
        name: "Outbound Conveyor",
        workCenterId: wcP,
        status: "IDLE",
        availabilityPct: 96,
        performancePct: 92,
        qualityPct: 99.5,
        createdAt: new Date("2026-03-25T10:00:00"),
        updatedAt: new Date("2026-04-05T16:00:00"),
      },
    ])
    .onConflictDoUpdate({
      target: schema.equipment.id,
      set: {
        name: sql`excluded.name`,
        status: sql`excluded.status`,
        availabilityPct: sql`excluded.availability_pct`,
        performancePct: sql`excluded.performance_pct`,
        qualityPct: sql`excluded.quality_pct`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  const wo1 = "wo-2026-0412";
  const wo2 = "wo-2026-0413";
  const wo3 = "wo-2026-0414";

  await db
    .insert(schema.workOrders)
    .values([
      {
        id: wo1,
        number: "WO-2026-0412",
        itemId: itPump,
        workCenterId: wcA,
        qtyTarget: 120,
        qtyCompleted: 72,
        status: "IN_PROGRESS",
        priority: 80,
        dueAt: new Date("2026-04-10T17:00:00"),
        notes: "Customer line A — expedite subassembly",
        createdAt: new Date("2026-03-28T11:00:00"),
        updatedAt: new Date("2026-04-07T08:00:00"),
      },
      {
        id: wo2,
        number: "WO-2026-0413",
        itemId: itValve,
        workCenterId: wcM,
        qtyTarget: 400,
        qtyCompleted: 400,
        status: "COMPLETED",
        priority: 40,
        dueAt: new Date("2026-04-06T12:00:00"),
        notes: null,
        createdAt: new Date("2026-03-30T09:00:00"),
        updatedAt: new Date("2026-04-06T14:00:00"),
      },
      {
        id: wo3,
        number: "WO-2026-0414",
        itemId: itBracket,
        workCenterId: wcM,
        qtyTarget: 600,
        qtyCompleted: 180,
        status: "RELEASED",
        priority: 55,
        dueAt: new Date("2026-04-12T08:00:00"),
        notes: "Batch run for spindle retrofit program",
        createdAt: new Date("2026-04-01T07:00:00"),
        updatedAt: new Date("2026-04-05T19:00:00"),
      },
      {
        id: "wo-2026-0415",
        number: "WO-2026-0415",
        itemId: itPump,
        workCenterId: wcP,
        qtyTarget: 60,
        qtyCompleted: 0,
        status: "PLANNED",
        priority: 30,
        dueAt: new Date("2026-04-15T16:00:00"),
        notes: null,
        createdAt: new Date("2026-04-02T13:00:00"),
        updatedAt: new Date("2026-04-02T13:00:00"),
      },
    ])
    .onConflictDoUpdate({
      target: schema.workOrders.id,
      set: {
        qtyTarget: sql`excluded.qty_target`,
        qtyCompleted: sql`excluded.qty_completed`,
        status: sql`excluded.status`,
        priority: sql`excluded.priority`,
        dueAt: sql`excluded.due_at`,
        notes: sql`excluded.notes`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .insert(schema.workOrderOperations)
    .values([
      {
        id: "op-wo1-10",
        workOrderId: wo1,
        sequence: 10,
        description: "Subassembly — valve manifold",
        plannedQty: 120,
        completedQty: 120,
        status: "DONE",
        createdAt: new Date("2026-03-29T06:00:00"),
        updatedAt: new Date("2026-04-02T12:00:00"),
      },
      {
        id: "op-wo1-20",
        workOrderId: wo1,
        sequence: 20,
        description: "Pressure test & leak check",
        plannedQty: 120,
        completedQty: 72,
        status: "RUNNING",
        createdAt: new Date("2026-03-29T06:00:00"),
        updatedAt: new Date("2026-04-07T07:00:00"),
      },
      {
        id: "op-wo3-10",
        workOrderId: wo3,
        sequence: 10,
        description: "Rough mill",
        plannedQty: 600,
        completedQty: 600,
        status: "DONE",
        createdAt: new Date("2026-04-01T08:00:00"),
        updatedAt: new Date("2026-04-04T22:00:00"),
      },
      {
        id: "op-wo3-20",
        workOrderId: wo3,
        sequence: 20,
        description: "Finish & deburr",
        plannedQty: 600,
        completedQty: 180,
        status: "RUNNING",
        createdAt: new Date("2026-04-01T08:00:00"),
        updatedAt: new Date("2026-04-06T05:00:00"),
      },
    ])
    .onConflictDoUpdate({
      target: schema.workOrderOperations.id,
      set: {
        description: sql`excluded.description`,
        plannedQty: sql`excluded.planned_qty`,
        completedQty: sql`excluded.completed_qty`,
        status: sql`excluded.status`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .insert(schema.qualityEvents)
    .values([
      {
        id: "qe-001",
        workOrderId: wo1,
        itemId: itPump,
        lotCode: "L-240401-A",
        defectType: "Surface scratch",
        qtyAffected: 3,
        status: "INVESTIGATING",
        notes: "Detected at final inspection station 2",
        reportedAt: new Date("2026-04-06T15:40:00"),
        createdAt: new Date("2026-04-06T15:40:00"),
        updatedAt: new Date("2026-04-07T09:00:00"),
      },
      {
        id: "qe-002",
        workOrderId: wo3,
        itemId: itBracket,
        lotCode: "L-240403-M",
        defectType: "Out of tolerance bore",
        qtyAffected: 12,
        status: "OPEN",
        notes: "CNC offset drift suspected",
        reportedAt: new Date("2026-04-05T11:10:00"),
        createdAt: new Date("2026-04-05T11:10:00"),
        updatedAt: new Date("2026-04-05T11:10:00"),
      },
      {
        id: "qe-003",
        workOrderId: null,
        itemId: itValve,
        lotCode: "L-240331-V",
        defectType: "Contamination",
        qtyAffected: 1,
        status: "CLOSED",
        notes: "Isolated supplier batch — NCR closed",
        reportedAt: new Date("2026-03-31T08:00:00"),
        createdAt: new Date("2026-03-31T08:00:00"),
        updatedAt: new Date("2026-04-02T10:00:00"),
      },
    ])
    .onConflictDoUpdate({
      target: schema.qualityEvents.id,
      set: {
        defectType: sql`excluded.defect_type`,
        qtyAffected: sql`excluded.qty_affected`,
        status: sql`excluded.status`,
        notes: sql`excluded.notes`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .insert(schema.inventoryLots)
    .values([
      {
        id: "lot-vv-2401",
        itemId: itValve,
        lotCode: "VV-2401",
        qtyOnHand: 820,
        location: "WH-A-12",
        status: "AVAILABLE",
        receivedAt: new Date("2026-03-27T10:00:00"),
        createdAt: new Date("2026-03-27T10:00:00"),
        updatedAt: new Date("2026-04-01T08:00:00"),
      },
      {
        id: "lot-br-2402",
        itemId: itBracket,
        lotCode: "BR-2402",
        qtyOnHand: 2400,
        location: "WH-B-04",
        status: "AVAILABLE",
        receivedAt: new Date("2026-04-01T06:00:00"),
        createdAt: new Date("2026-04-01T06:00:00"),
        updatedAt: new Date("2026-04-04T12:00:00"),
      },
      {
        id: "lot-se-2399",
        itemId: "item-seal-88",
        lotCode: "SE-2399",
        qtyOnHand: 45,
        location: "WH-C-01",
        status: "QUARANTINE",
        receivedAt: new Date("2026-03-30T14:00:00"),
        createdAt: new Date("2026-03-30T14:00:00"),
        updatedAt: new Date("2026-04-03T09:00:00"),
      },
    ])
    .onConflictDoUpdate({
      target: schema.inventoryLots.id,
      set: {
        qtyOnHand: sql`excluded.qty_on_hand`,
        location: sql`excluded.location`,
        status: sql`excluded.status`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => pool.end());
