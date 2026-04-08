import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  real,
  unique,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { relations } from "drizzle-orm";

// ─── Enums ───
export const workCenterStatusEnum = pgEnum("work_center_status", [
  "ACTIVE",
  "INACTIVE",
]);

export const equipmentStatusEnum = pgEnum("equipment_status", [
  "RUNNING",
  "IDLE",
  "DOWN",
  "MAINTENANCE",
]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "PLANNED",
  "RELEASED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);

export const operationStatusEnum = pgEnum("operation_status", [
  "PENDING",
  "RUNNING",
  "DONE",
]);

export const qualityEventStatusEnum = pgEnum("quality_event_status", [
  "OPEN",
  "INVESTIGATING",
  "CLOSED",
]);

export const inventoryLotStatusEnum = pgEnum("inventory_lot_status", [
  "AVAILABLE",
  "QUARANTINE",
  "CONSUMED",
]);

// ─── Tables ───
export const workCenters = pgTable("work_centers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  area: text("area").notNull(),
  status: workCenterStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const items = pgTable("items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  uom: text("uom").notNull().default("EA"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const equipment = pgTable("equipment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  workCenterId: text("work_center_id")
    .notNull()
    .references(() => workCenters.id, { onDelete: "restrict" }),
  status: equipmentStatusEnum("status").notNull().default("IDLE"),
  availabilityPct: real("availability_pct").notNull().default(92),
  performancePct: real("performance_pct").notNull().default(88),
  qualityPct: real("quality_pct").notNull().default(99),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const workOrders = pgTable("work_orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "restrict" }),
  workCenterId: text("work_center_id").references(() => workCenters.id, {
    onDelete: "set null",
  }),
  qtyTarget: integer("qty_target").notNull(),
  qtyCompleted: integer("qty_completed").notNull().default(0),
  status: workOrderStatusEnum("status").notNull().default("PLANNED"),
  priority: integer("priority").notNull().default(50),
  dueAt: timestamp("due_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const workOrderOperations = pgTable(
  "work_order_operations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workOrderId: text("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    description: text("description").notNull(),
    plannedQty: integer("planned_qty").notNull(),
    completedQty: integer("completed_qty").notNull().default(0),
    status: operationStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [unique().on(t.workOrderId, t.sequence)],
);

export const qualityEvents = pgTable("quality_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workOrderId: text("work_order_id").references(() => workOrders.id, {
    onDelete: "set null",
  }),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "restrict" }),
  lotCode: text("lot_code"),
  defectType: text("defect_type").notNull(),
  qtyAffected: integer("qty_affected").notNull(),
  status: qualityEventStatusEnum("status").notNull().default("OPEN"),
  notes: text("notes"),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const inventoryLots = pgTable("inventory_lots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "restrict" }),
  lotCode: text("lot_code").notNull(),
  qtyOnHand: integer("qty_on_hand").notNull(),
  location: text("location").notNull(),
  status: inventoryLotStatusEnum("status").notNull().default("AVAILABLE"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

// ─── Relations (for Drizzle queries) ───
export const workCentersRelations = relations(workCenters, ({ many }) => ({
  equipment: many(equipment),
  workOrders: many(workOrders),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  workOrders: many(workOrders),
  qualityEvents: many(qualityEvents),
  inventoryLots: many(inventoryLots),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  workCenter: one(workCenters, {
    fields: [equipment.workCenterId],
    references: [workCenters.id],
  }),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  item: one(items, { fields: [workOrders.itemId], references: [items.id] }),
  workCenter: one(workCenters, {
    fields: [workOrders.workCenterId],
    references: [workCenters.id],
  }),
  operations: many(workOrderOperations),
  qualityEvents: many(qualityEvents),
}));

export const workOrderOperationsRelations = relations(
  workOrderOperations,
  ({ one }) => ({
    workOrder: one(workOrders, {
      fields: [workOrderOperations.workOrderId],
      references: [workOrders.id],
    }),
  }),
);

export const qualityEventsRelations = relations(qualityEvents, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [qualityEvents.workOrderId],
    references: [workOrders.id],
  }),
  item: one(items, {
    fields: [qualityEvents.itemId],
    references: [items.id],
  }),
}));

export const inventoryLotsRelations = relations(inventoryLots, ({ one }) => ({
  item: one(items, {
    fields: [inventoryLots.itemId],
    references: [items.id],
  }),
}));

// ─── Zod ───
export const insertWorkCenterSchema = createInsertSchema(workCenters);
export const selectWorkCenterSchema = createSelectSchema(workCenters);
export const updateWorkCenterSchema = createUpdateSchema(workCenters);

export const insertItemSchema = createInsertSchema(items);
export const selectItemSchema = createSelectSchema(items);
export const updateItemSchema = createUpdateSchema(items);

export const insertEquipmentSchema = createInsertSchema(equipment);
export const selectEquipmentSchema = createSelectSchema(equipment);
export const updateEquipmentSchema = createUpdateSchema(equipment);

export const insertWorkOrderSchema = createInsertSchema(workOrders);
export const selectWorkOrderSchema = createSelectSchema(workOrders);
export const updateWorkOrderSchema = createUpdateSchema(workOrders);

export const insertWorkOrderOperationSchema =
  createInsertSchema(workOrderOperations);
export const selectWorkOrderOperationSchema =
  createSelectSchema(workOrderOperations);
export const updateWorkOrderOperationSchema =
  createUpdateSchema(workOrderOperations);

export const insertQualityEventSchema = createInsertSchema(qualityEvents);
export const selectQualityEventSchema = createSelectSchema(qualityEvents);
export const updateQualityEventSchema = createUpdateSchema(qualityEvents);

export const insertInventoryLotSchema = createInsertSchema(inventoryLots);
export const selectInventoryLotSchema = createSelectSchema(inventoryLots);
export const updateInventoryLotSchema = createUpdateSchema(inventoryLots);

// ─── Types ───
export type WorkCenter = typeof workCenters.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type WorkOrderOperation = typeof workOrderOperations.$inferSelect;
export type QualityEvent = typeof qualityEvents.$inferSelect;
export type InventoryLot = typeof inventoryLots.$inferSelect;
