import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterToPredicate, queryRequestToFind } from "../src/lib/data/query";

// Schema compilation and write validation are tested in @tier0/sdk-v2/data;
// the component kit's QueryRequest conversion is Scaffold code.

describe("query conversion", () => {
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
