import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { StreamRequestError, StreamRequestResultUnknownError } from "@tier0/sdk-v2";

test("the unified SDK pins one bundled artifact and its integrity", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const dependency = pkg.dependencies["@tier0/sdk-v2"];
  const locked = lock.packages["node_modules/@tier0/sdk-v2"];
  const artifact = `vendor/tier0-sdk-v2-${locked.version}.tgz`;
  const archive = readFileSync(artifact);
  assert.equal(pkg.dependencies["@tier0/sdk"], undefined);
  assert.equal(dependency, `file:${artifact}`);
  assert.equal(lock.packages[""].dependencies["@tier0/sdk-v2"], dependency);
  assert.equal(locked.resolved, `file:${artifact}`);
  assert.equal(locked.integrity, `sha512-${createHash("sha512").update(archive).digest("base64")}`);
  const known = new StreamRequestError("conflict", { errorCode: "IDEMPOTENCY_CONFLICT" });
  const unknown = new StreamRequestResultUnknownError({ errorCode: "STREAM_REQUEST_RESULT_UNKNOWN" });
  assert.equal(known.outcomeUnknown, false);
  assert.equal(unknown.outcomeUnknown, true);
  assert.equal(known.retryable, false);
  assert.equal(unknown.retryable, false);
  assert.equal(known.execution, undefined);
  assert.equal(unknown.execution, undefined);
  const notStarted = new StreamRequestError("credential resolution failed", {
    errorCode: "STREAM_REQUEST_TRANSPORT_ERROR", execution: "notStarted",
  });
  assert.equal(notStarted.execution, "notStarted");
  assert.equal(notStarted.outcomeUnknown, false);
  assert.equal(notStarted.retryable, false);
});
