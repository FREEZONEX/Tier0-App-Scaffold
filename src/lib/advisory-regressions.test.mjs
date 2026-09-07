import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("keeps composed pages and wrapped mutation callers deployable while reporting uncertainty", () => {
  const root = mkdtempSync(join(tmpdir(), "scaffold-advisory-"));
  const files = {
    "src/routes/_app.index.tsx": 'import { Items } from "../components/Items"; export const Page = () => <Items />;',
    "src/routes/_app.items.tsx": 'import { Outlet } from "@tanstack/react-router"; export const Page = () => <Outlet />;',
    "src/routes/api/items.ts": 'createFileRoute("/api/items")({ server: { handlers: {\nPOST: () => new Response()\n} } });',
    "src/components/Items.tsx": 'const request = (url, init) => fetch(apiUrl(url), init); export const Items = () => <button onClick={() => request("/api/items", { method: "POST" })}>Create</button>;',
  };
  try {
    for (const [name, source] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), source);
    }
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    for (const [testFile, expected] of [
      ["content-contracts.test.mjs", "lifecycle advisory"],
      ["write-path-contracts.test.mjs", "write-path advisory"],
    ]) {
      const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--test-name-pattern=reports", fileURLToPath(new URL(testFile, import.meta.url))], { cwd: root, encoding: "utf8", env });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.ok(result.stdout.includes(expected), result.stdout);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
