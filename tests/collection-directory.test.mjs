import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { assertCollectionDirectory } from "../scripts/collection-directory-contract.mjs";

test("placement gate rejects missing paths and SDKs that discard placement", () => {
  assert.throws(() => assertCollectionDirectory({ alias: "orders" }, {}), /declare directoryPath/);
  assert.throws(() => assertCollectionDirectory({ alias: "orders", directoryPath: [] }, {}), /declare directoryPath/);
  const definition = { alias: "orders", directoryPath: ["North Plant", "Assembly"] };
  assert.throws(() => assertCollectionDirectory(definition, {}), /SDK must preserve directoryPath/);
  assert.doesNotThrow(() => assertCollectionDirectory(definition, { directoryPath: [...definition.directoryPath] }));
});

function payloadFor(directoryPath, alias) {
  // 放在仓库内以使用真正安装的 SDK；每个用例都清理自己创建的隔离目录。
  const root = mkdtempSync(join(process.cwd(), ".directory-contract-"));
  try {
    mkdirSync(join(root, "src/data"), { recursive: true });
    const pathProperty = directoryPath === undefined ? "" : `directoryPath: ${JSON.stringify(directoryPath)},`;
    writeFileSync(join(root, "src/data/collections.ts"), `
import { z } from "zod";
import { defineCollection } from "@tier0/sdk-v2/data/define";
export const collections = [defineCollection({ alias: "orders", name: "Work orders", ${pathProperty} schema: z.object({ code: z.string() }) })];
`, "utf8");
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/data-schema.mjs"), ...(alias ? [alias] : [])], {
      cwd: root, env, encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("actual ensure payload preserves shared and equipment scopes without forcing five levels", () => {
  for (const directoryPath of [["Product Management"], ["北厂", "装配车间", "一号线"], ["工厂", "产线", "MES"]]) {
    const result = payloadFor(directoryPath);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).collections[0].directoryPath, directoryPath);
  }
});

test("new App payload generation fails on missing placement instead of creating an App folder", () => {
  const result = payloadFor(undefined);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /declare directoryPath/);
});

test("schema replacement output excludes creation-only directoryPath and name", () => {
  const result = payloadFor(["North Plant", "Quality"], "orders");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.alias, "orders");
  assert.ok(payload.recordSchema);
  assert.equal(Object.hasOwn(payload, "directoryPath"), false);
  assert.equal(Object.hasOwn(payload, "name"), false);
});
