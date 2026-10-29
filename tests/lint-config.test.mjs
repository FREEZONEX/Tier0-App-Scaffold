import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

// agent-worker materializes managed skills into .tier0/ inside the App
// workspace; their CommonJS scripts must not fail the App's `eslint .`.
const COMMONJS = 'const fs = require("node:fs");\nmodule.exports = fs;\n';

async function lint(filePath) {
  const [result] = await new ESLint().lintText(COMMONJS, { filePath, warnIgnored: false });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

test("platform files under .tier0/ are not linted", async () => {
  assert.deepEqual(await lint(".tier0/managed-skills/current/skills/demo/scripts/run.js"), []);
});

test("the same CommonJS file in App code is still reported", async () => {
  assert.ok((await lint("scripts/run.js")).includes("@typescript-eslint/no-require-imports"));
});
