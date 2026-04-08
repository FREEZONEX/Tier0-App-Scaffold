import { db } from "@/db";
import { workOrders, workOrderOperations, equipment } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

type WorkOrderStatus =
  | "PLANNED"
  | "RELEASED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";
type EquipmentStatus = "RUNNING" | "IDLE" | "DOWN" | "MAINTENANCE";
type OperationStatus = "PENDING" | "RUNNING" | "DONE";
type QualityEventStatus = "OPEN" | "INVESTIGATING" | "CLOSED";
type InventoryLotStatus = "AVAILABLE" | "QUARANTINE" | "CONSUMED";

const workOrderTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PLANNED: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "RELEASED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const equipmentTransitions: Record<EquipmentStatus, EquipmentStatus[]> = {
  RUNNING: ["IDLE", "DOWN", "MAINTENANCE"],
  IDLE: ["RUNNING", "DOWN", "MAINTENANCE"],
  DOWN: ["IDLE", "MAINTENANCE"],
  MAINTENANCE: ["IDLE", "DOWN"],
};

const operationTransitions: Record<OperationStatus, OperationStatus[]> = {
  PENDING: ["RUNNING", "DONE"],
  RUNNING: ["PENDING", "DONE"],
  DONE: [],
};

const qualityTransitions: Record<QualityEventStatus, QualityEventStatus[]> = {
  OPEN: ["INVESTIGATING", "CLOSED"],
  INVESTIGATING: ["OPEN", "CLOSED"],
  CLOSED: [],
};

const inventoryTransitions: Record<
  InventoryLotStatus,
  InventoryLotStatus[]
> = {
  AVAILABLE: ["QUARANTINE", "CONSUMED"],
  QUARANTINE: ["AVAILABLE", "CONSUMED"],
  CONSUMED: [],
};

export function isValidTransition(
  entity: "work_order",
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean;
export function isValidTransition(
  entity: "equipment",
  from: EquipmentStatus,
  to: EquipmentStatus,
): boolean;
export function isValidTransition(
  entity: "operation",
  from: OperationStatus,
  to: OperationStatus,
): boolean;
export function isValidTransition(
  entity: "quality_event",
  from: QualityEventStatus,
  to: QualityEventStatus,
): boolean;
export function isValidTransition(
  entity: "inventory_lot",
  from: InventoryLotStatus,
  to: InventoryLotStatus,
): boolean;
export function isValidTransition(
  entity: string,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  switch (entity) {
    case "work_order":
      return (workOrderTransitions[from as WorkOrderStatus] ?? []).includes(
        to as WorkOrderStatus,
      );
    case "equipment":
      return (equipmentTransitions[from as EquipmentStatus] ?? []).includes(
        to as EquipmentStatus,
      );
    case "operation":
      return (operationTransitions[from as OperationStatus] ?? []).includes(
        to as OperationStatus,
      );
    case "quality_event":
      return (qualityTransitions[from as QualityEventStatus] ?? []).includes(
        to as QualityEventStatus,
      );
    case "inventory_lot":
      return (inventoryTransitions[from as InventoryLotStatus] ?? []).includes(
        to as InventoryLotStatus,
      );
    default:
      return false;
  }
}

/** Sum completed qty from operations into the parent work order (capped by target). */
export async function recalcWorkOrderTotals(workOrderId: string): Promise<void> {
  const [wo] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  if (!wo) return;

  const rows = await db
    .select({
      sum: sql<number>`coalesce(sum(${workOrderOperations.completedQty}), 0)::int`,
    })
    .from(workOrderOperations)
    .where(eq(workOrderOperations.workOrderId, workOrderId));

  const fromOps = rows[0]?.sum ?? 0;
  const capped = Math.min(wo.qtyTarget, fromOps);

  await db
    .update(workOrders)
    .set({
      qtyCompleted: capped,
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, workOrderId));
}

/** Average OEE components from equipment on a work center (for dashboard). */
export async function avgOeeForWorkCenter(
  workCenterId: string,
): Promise<{ a: number; p: number; q: number }> {
  const rows = await db
    .select({
      a: sql<number>`coalesce(avg(${equipment.availabilityPct}), 0)`,
      p: sql<number>`coalesce(avg(${equipment.performancePct}), 0)`,
      q: sql<number>`coalesce(avg(${equipment.qualityPct}), 0)`,
    })
    .from(equipment)
    .where(eq(equipment.workCenterId, workCenterId));

  const r = rows[0];
  return {
    a: Math.round(Number(r?.a ?? 0)),
    p: Math.round(Number(r?.p ?? 0)),
    q: Math.round(Number(r?.q ?? 0)),
  };
}
