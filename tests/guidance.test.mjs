import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function run(body, strict = false) {
  const env = { ...process.env, SCAFFOLD_GUIDANCE_STRICT: strict ? "1" : "0" };
  delete env.NODE_TEST_CONTEXT;
  const source = `import assert from 'node:assert/strict';
import { guidanceIt } from './scripts/guidance-test.mjs';
guidanceIt('fixture', () => { ${body} });`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", source], { env, encoding: "utf8" });
}

test("guidance assertions report an advisory without failing App builds", () => {
  const result = run('assert.equal(4, 3, "business needs four roles")');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /\[advisory\].*business needs four roles/);
});
test("scaffold CI can enforce its own default recipes", () => {
  assert.equal(run("assert.equal(4, 3)", true).status, 1);
});
test("broken checks and runtime exceptions are never swallowed", () => {
  assert.equal(run('throw new TypeError("broken analyzer")').status, 1);
});

function fixture(files, command) {
  const root = mkdtempSync(join(tmpdir(), "guidance-integration-"));
  try {
    for (const directory of ["src/lib", "src/components", "src/routes", "src/services", "scripts"]) mkdirSync(join(root, directory), { recursive: true });
    for (const [path, content] of Object.entries(files)) writeFileSync(join(root, path), content ?? readFileSync(path));
    const env = { ...process.env, SCAFFOLD_GUIDANCE_STRICT: "0" };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, command, { cwd: root, env, encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("real content/copy checks allow read-only pages and contextual explanations", () => {
  const result = fixture({
    "scripts/guidance-test.mjs": null,
    "src/lib/content-contracts.test.mjs": null,
    "src/lib/copy-contracts.test.mjs": null,
    "AGENTS.md": null,
    "src/routes/_app.report.tsx": 'const rows = useRequest("report"); <p>当前角色：质检员。本页用于展示审计记录；此格式暂不支持导出。</p>',
  }, ["--test", "src/lib/content-contracts.test.mjs", "src/lib/copy-contracts.test.mjs"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /\[advisory\]/);
});

test("runtime audit allows custom loading UI but still rejects import-time service work", () => {
  const files = {
    "scripts/runtime-audit.mjs": null,
    "src/components/custom.tsx": 'const data = useRequest("records"); if (!data) return null;',
  };
  const advisory = fixture(files, ["scripts/runtime-audit.mjs"]);
  assert.equal(advisory.status, 0, advisory.stdout + advisory.stderr);
  assert.match(advisory.stderr, /\[advisory\]/);
  const blocked = fixture({ ...files, "src/services/unsafe.ts": 'const records = await loadRecords();' }, ["scripts/runtime-audit.mjs"]);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /top-level await/);
});
