import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSchemaFile } from "./parse-file";

const validJson = JSON.stringify({
  meta: { name: "x", version: 1 },
  nodes: [{ id: "A", type: "tank", x: 0, y: 0, topics: [], bindings: {} }],
  edges: [],
});

describe("parseSchemaFile", () => {
  it("合法 JSON + schema → ok", () => {
    const r = parseSchemaFile(validJson);
    assert.equal(r.ok, true);
    assert.equal(r.data?.nodes[0].id, "A");
  });
  it("非法 JSON → 明确错误", () => {
    const r = parseSchemaFile("{ not json");
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /JSON/);
  });
  it("合法 JSON 但 schema 不符 → 字段级错误", () => {
    const r = parseSchemaFile(JSON.stringify({ meta: { version: 1 }, nodes: [] }));
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /meta\.name/);
  });
});
