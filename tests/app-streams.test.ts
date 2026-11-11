import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { StreamRequestError, StreamRequestResultUnknownError } from "@tier0/sdk-v2";

test("the unified SDK pins one exact npm release and its integrity", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const dependency = pkg.dependencies["@tier0/sdk-v2"];
  const locked = lock.packages["node_modules/@tier0/sdk-v2"];
  assert.equal(pkg.dependencies["@tier0/sdk"], undefined);
  assert.equal(dependency, locked.version);
  assert.equal(lock.packages[""].dependencies["@tier0/sdk-v2"], dependency);
  assert.equal(locked.resolved, `https://registry.npmjs.org/@tier0/sdk-v2/-/sdk-v2-${locked.version}.tgz`);
  assert.match(locked.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
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
