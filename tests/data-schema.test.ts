import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { defineCollection } from "../src/lib/data/define";
import { filterToPredicate, queryRequestToFind, toSortPairs } from "../src/lib/data/query";
import {
  CollectionSchemaError,
  compileCollection,
  toRecordSchema,
  validateDocument,
  validateUpdate,
  zodJsonSchema,
} from "../src/lib/data/schema";

const SAFE = Number.MAX_SAFE_INTEGER;

const workOrderSchema = z.object({
  code: z.string().describe("Work order code"),
  qty: z.number().int().min(1),
  price: z.number().min(0).max(1000),
  status: z.enum(["DRAFT", "DONE", "DRAFT"]),
  line: z.object({ id: z.string(), name: z.string() }),
  lines: z.array(z.object({ sku: z.string(), count: z.number().int() })),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

function schemaError(schema: z.ZodType): CollectionSchemaError {
  try {
    toRecordSchema("probe", schema);
  } catch (error) {
    assert.ok(error instanceof CollectionSchemaError, String(error));
    return error;
  }
  assert.fail("expected the schema to be rejected");
}

describe("zod 4 toJSONSchema output (snapshot)", () => {
  // Pins what zod actually emits; the normalizer below depends on this shape.
  it("emits closed objects, safe-integer bounds and output-mode required lists", () => {
    assert.deepEqual(zodJsonSchema(workOrderSchema), {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        code: { type: "string", description: "Work order code" },
        qty: { type: "integer", minimum: 1, maximum: SAFE },
        price: { type: "number", minimum: 0, maximum: 1000 },
        // z.enum already de-duplicates its values.
        status: { type: "string", enum: ["DRAFT", "DONE"] },
        line: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" } },
          required: ["id", "name"],
          additionalProperties: false,
        },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: { sku: { type: "string" }, count: { type: "integer", minimum: -SAFE, maximum: SAFE } },
            required: ["sku", "count"],
            additionalProperties: false,
          },
        },
        tags: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["code", "qty", "price", "status", "line", "lines"],
      additionalProperties: false,
    });
  });

  it("emits the keywords the normalizer must reject", () => {
    const raw = (schema: z.ZodType) => zodJsonSchema(z.object({ field: schema })).properties as Record<string, unknown>;
    assert.deepEqual(raw(z.string().nullable()).field, { anyOf: [{ type: "string" }, { type: "null" }] });
    assert.deepEqual(raw(z.string().default("x")).field, { default: "x", type: "string" });
    assert.deepEqual(raw(z.string().min(1)).field, { type: "string", minLength: 1 });
    assert.deepEqual(raw(z.literal("k")).field, { type: "string", const: "k" });
    assert.deepEqual(raw(z.number().positive()).field, { type: "number", exclusiveMinimum: 0 });
    assert.deepEqual(raw(z.record(z.string(), z.number())).field, {
      type: "object",
      propertyNames: { type: "string" },
      additionalProperties: { type: "number" },
    });
    const email = raw(z.email()).field as Record<string, unknown>;
    assert.equal(email.format, "email");
    assert.equal(typeof email.pattern, "string");
  });
});

describe("toRecordSchema", () => {
  it("normalizes to the UNS subset", () => {
    assert.deepEqual(toRecordSchema("work_orders", workOrderSchema), {
      type: "object",
      properties: {
        code: { type: "string", description: "Work order code" },
        qty: { type: "integer", minimum: 1 },
        price: { type: "number", minimum: 0, maximum: 1000 },
        status: { type: "string", enum: ["DRAFT", "DONE"] },
        line: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" } },
          required: ["id", "name"],
          additionalProperties: false,
        },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: { sku: { type: "string" }, count: { type: "integer" } },
            required: ["count", "sku"],
            additionalProperties: false,
          },
        },
        tags: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["code", "line", "lines", "price", "qty", "status"],
      additionalProperties: false,
    });
  });

  it("closes objects even when zod leaves them open in input mode", () => {
    const schema = toRecordSchema("x", z.object({ nested: z.strictObject({ a: z.boolean() }) }));
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties?.nested.additionalProperties, false);
  });

  it("rejects unstorable constructs with a concrete replacement", () => {
    const cases: [z.ZodType, RegExp][] = [
      [z.object({ a: z.string().nullable() }), /\.optional\(\)/],
      [z.object({ a: z.union([z.string(), z.number()]) }), /z\.union\(\)/],
      [z.object({ a: z.string().default("x") }), /Apply defaults in the service/],
      [z.object({ a: z.email() }), /toISOString|API input schema/],
      [z.object({ a: z.string().regex(/x/) }), /pattern/],
      [z.object({ a: z.string().min(1) }), /API input schema/],
      [z.object({ a: z.literal("k") }), /z\.enum/],
      [z.object({ a: z.number().positive() }), /inclusive `\.min\(\)`/],
      [z.object({ a: z.record(z.string(), z.number()) }), /closed/],
      [z.looseObject({ a: z.string() }), /closed/],
      [z.object({ a: z.array(z.string()).min(1) }), /Array length/],
      [z.object({ a: z.any() }), /concrete type/],
      [z.object({ a: z.tuple([z.string(), z.number()]) }), /z\.tuple\(\)/],
      [z.object({ _id: z.string() }), /system field/],
      [z.object({ "a.b": z.string() }), /must not contain/],
      [z.object({ "[]": z.string() }), /reserved/],
    ];
    for (const [schema, hint] of cases) {
      const error = schemaError(schema);
      assert.match(error.message, hint, error.message);
    }
  });

  it("explains unrepresentable zod types", () => {
    assert.match(schemaError(z.object({ at: z.date() })).message, /toISOString/);
    assert.match(schemaError(z.object({ n: z.string().transform((value) => value.length) })).message, /transforms/);
  });

  it("measures title and description in UTF-8 bytes like UNS", () => {
    assert.equal(toRecordSchema("x", z.object({ a: z.string().describe("a".repeat(2048)) })).properties?.a.description?.length, 2048);
    // 683 CJK characters are 2049 bytes.
    assert.match(schemaError(z.object({ a: z.string().describe("中".repeat(683)) })).message, /2048 UTF-8 bytes/);
  });

  it("enforces UNS limits", () => {
    let deep: z.ZodType = z.string();
    for (let level = 0; level < 9; level += 1) deep = z.object({ next: deep });
    assert.match(schemaError(deep as z.ZodObject).message, /deeper than 8/);
    const wide = Object.fromEntries(Array.from({ length: 129 }, (_, index) => [`f${index}`, z.string()]));
    assert.match(schemaError(z.object(wide)).message, /128 properties/);
  });
});

describe("compileCollection", () => {
  it("normalizes indexes and validates paths", () => {
    const compiled = compileCollection(
      defineCollection({
        alias: "orders",
        schema: workOrderSchema,
        indexes: [{ path: "code", unique: true }, { paths: ["status", "line.id"] }, { path: "tags", kind: "gin" }, { path: "code", unique: true }],
      }),
    );
    assert.deepEqual(compiled.indexes, [{ path: "code", unique: true }, { paths: ["status", "line.id"] }, { path: "tags", kind: "gin" }]);
  });

  it("rejects invalid indexes", () => {
    const bad = (indexes: Parameters<typeof defineCollection>[0]["indexes"]) =>
      assert.throws(() => compileCollection(defineCollection({ alias: "orders", schema: workOrderSchema, indexes })), CollectionSchemaError);
    bad([{ path: "missing" }]);
    bad([{ path: "tags", kind: "gin", unique: true }]);
    bad([{ path: "line" }]);
    bad([{ path: "code", paths: ["qty"] }]);
    bad([{ paths: ["code", "qty", "price", "status"] }]);
    bad([{ paths: ["code", "code"] }]);
    bad([{ path: "code", kind: "gin" }]);
  });

  it("explains index paths that reach into array items", () => {
    try {
      compileCollection(defineCollection({ alias: "orders", schema: workOrderSchema, indexes: [{ path: "lines.sku" }] }));
      assert.fail("expected rejection");
    } catch (error) {
      assert.ok(error instanceof CollectionSchemaError);
      assert.match(error.message, /reaches into the items of array "lines"/);
    }
    assert.throws(() => compileCollection(defineCollection({ alias: "orders", schema: workOrderSchema, indexes: [{ path: "lines.0.sku" }] })), CollectionSchemaError);
  });

  it("validates aliases, description length and seed size", () => {
    assert.throws(() => defineCollection({ alias: "9orders", schema: workOrderSchema }), /must match/);
    defineCollection({ alias: "ok", schema: z.object({ a: z.string() }), description: "中".repeat(512) });
    assert.throws(() => defineCollection({ alias: "long", schema: z.object({ a: z.string() }), description: "a".repeat(513) }), /512 characters/);
    const seed = Array.from({ length: 1001 }, (_, n) => ({ _id: `s${n}`, a: "x" }));
    assert.throws(() => defineCollection({ alias: "seeded", schema: z.object({ a: z.string() }), seed }), /at most 1000 seed documents/);
  });
});

describe("write validation", () => {
  const orders = defineCollection({ alias: "orders", schema: workOrderSchema });
  const doc = {
    code: "WO-1",
    qty: 2,
    price: 10,
    status: "DRAFT" as const,
    line: { id: "l1", name: "Line 1" },
    lines: [{ sku: "A", count: 1 }],
  };

  it("splits _id, drops _meta and strictly validates the body", () => {
    assert.deepEqual(validateDocument(orders, { ...doc, _id: "wo-1", _meta: { revision: 3 } }), { id: "wo-1", data: doc });
    assert.throws(() => validateDocument(orders, { ...doc, extra: 1 }), (error: unknown) => error instanceof z.ZodError && /extra/.test(error.message));
    assert.throws(
      () => validateDocument(orders, { ...doc, lines: [{ sku: "A", count: 1, colour: "red" }] }),
      (error: unknown) => error instanceof z.ZodError && error.issues[0].path.join(".") === "lines.0",
    );
    assert.throws(() => validateDocument(orders, { ...doc, qty: 0 }), z.ZodError);
    assert.throws(() => validateDocument(orders, { ...doc, _id: "" }), z.ZodError);
  });

  it("validates update operator paths and values", () => {
    assert.deepEqual(validateUpdate(orders, { $set: { status: "DONE", "line.name": "L" }, $inc: { qty: 1 } }), {
      $set: { status: "DONE", "line.name": "L" },
      $inc: { qty: 1 },
    });
    assert.deepEqual(validateUpdate(orders, { $push: { lines: { $each: [{ sku: "B", count: 2 }] } } }), {
      $push: { lines: { $each: [{ sku: "B", count: 2 }] } },
    });
    assert.deepEqual(validateUpdate(orders, { $set: { "lines.$.count": 3, notes: undefined } }), { $set: { "lines.$.count": 3 } });
    assert.throws(() => validateUpdate(orders, { $set: { missing: 1 } }), /not a declared field/);
    assert.throws(() => validateUpdate(orders, { $set: { status: "LOST" } }), z.ZodError);
    assert.throws(() => validateUpdate(orders, { $set: { line: { id: "x", name: "y", z: 1 } } }), /Unknown field/);
    assert.throws(() => validateUpdate(orders, { $push: { lines: { sku: "B" } } }), z.ZodError);
    assert.throws(() => validateUpdate(orders, { $inc: { code: 1 } }), /numeric field/);
    assert.throws(() => validateUpdate(orders, { $set: { "_meta.revision": 1 } }), /read-only/);
    assert.throws(() => validateUpdate(orders, { status: "DONE" }), /use replaceOne/);
    assert.throws(() => validateUpdate(orders, { $set: { notes: undefined } }), /\$unset/);
  });
});

describe("query conversion", () => {
  it("converts Mongo sort specs to UNS pairs", () => {
    assert.deepEqual(toSortPairs({ status: 1, "_meta.createdAt": "desc" }), [["status", 1], ["_meta.createdAt", -1]]);
    assert.deepEqual(toSortPairs([["code", -1]]), [["code", -1]]);
    assert.equal(toSortPairs({}), undefined);
    assert.throws(() => toSortPairs({ a: 1, b: 1, c: 1, d: 1, e: 1 }), /4 fields/);
  });

  it("maps component-kit filters", () => {
    assert.deepEqual(filterToPredicate({ field: "name", operator: "LIKE", value: "pump" }), { name: { $contains: "pump" } });
    assert.deepEqual(filterToPredicate({ field: "name", operator: "NOT_LIKE", value: "pump" }), { $nor: [{ name: { $contains: "pump" } }] });
    assert.deepEqual(filterToPredicate({ field: "owner", operator: "IN", value: [{ id: "u1", name: "A" }, "u2"] }, { paths: { owner: "owner.id" } }), {
      "owner.id": { $in: ["u1", "u2"] },
    });
    assert.deepEqual(filterToPredicate({ field: "due", operator: "BETWEEN", value: ["2026-01-01", "2026-01-31"] }), {
      due: { $gte: "2026-01-01", $lte: "2026-01-31" },
    });
    assert.deepEqual(filterToPredicate({ field: "at", operator: "BETWEEN", value: ["2026-01-01", "2026-01-01"] }, { instantFields: ["at"] }), {
      at: { $gte: "2025-12-31T16:00:00.000Z", $lt: "2026-01-01T16:00:00.000Z" },
    });
    assert.deepEqual(filterToPredicate({ field: "notes", operator: "IS_NULL" }), { notes: { $exists: false } });
    assert.equal(filterToPredicate({ field: "name", operator: "LIKE", value: "" }), null);
    assert.equal(filterToPredicate({ field: "status", operator: "EQ" }), null);
  });

  it("builds filter, sort and page from a QueryRequest", () => {
    assert.deepEqual(
      queryRequestToFind({
        filters: [
          { field: "status", operator: "EQ", value: "OPEN" },
          { field: "qty", operator: "GTE", value: 3 },
        ],
        sorts: [{ field: "createdAt", direction: "desc" }],
        page: { current: 2, pageSize: 500 },
        ids: ["a"],
      }, { paths: { createdAt: "_meta.createdAt" } }),
      {
        filter: { $and: [{ status: "OPEN" }, { qty: { $gte: 3 } }, { _id: { $in: ["a"] } }] },
        sort: [["_meta.createdAt", -1]],
        page: 2,
        pageSize: 200,
      },
    );
    assert.deepEqual(queryRequestToFind({}), { filter: {}, page: 1, pageSize: 20 });
  });
});
