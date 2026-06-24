import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePayload } from "./payload";

describe("parsePayload", () => {
  it("合法 JSON → 解析对象", () => assert.deepEqual(parsePayload('{"run":1}'), { run: 1 }));
  it("非 JSON → 原始字符串", () => assert.equal(parsePayload("START"), "START"));
});
