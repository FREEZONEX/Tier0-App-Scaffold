// Gate integrity — hard verification stage (DO NOT modify).
//
// The LOCKED_FILES below are invariant quality gates: contract tests and
// verification scripts that encode platform rules. Generated apps must never
// edit, weaken, or delete them; the one file agents ARE expected to adapt is
// src/lib/template-state.test.mjs, which is deliberately not pinned here.
//
// scripts/gate-integrity.json pins a sha256 per locked file. Any drift fails
// the build. Template maintainers who intentionally change a locked gate
// regenerate the pins with:  node scripts/gate-integrity.mjs --update
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MANIFEST_PATH = "scripts/gate-integrity.json";

const LOCKED_FILES = [
  "src/lib/gateway.test.ts",
  "src/lib/permissions.test.mjs",
  "src/lib/app-chrome.test.mjs",
  "src/lib/navigation-contracts.test.mjs",
  "src/lib/content-contracts.test.mjs",
  "src/lib/button-contracts.test.mjs",
  "src/lib/form-contracts.test.mjs",
  "src/lib/overlay-contracts.test.mjs",
  "src/lib/interaction-contracts.test.mjs",
  "src/lib/table-contracts.test.mjs",
  "src/lib/copy-contracts.test.mjs",
  "src/lib/db-contracts.test.mjs",
  "src/lib/route-smoke-contracts.test.mjs",
  "src/lib/hooks-contracts.test.mjs",
  "src/lib/runtime-safety.test.mjs",
  "src/lib/write-path-contracts.test.mjs",
  "src/lib/ui-primitives-contracts.test.mjs",
  "scripts/ui-advisories.mjs",
  "scripts/route-smoke.mjs",
  "scripts/post-build-verify.mjs",
  "scripts/gate-integrity.mjs",
];

// Normalize line endings so pins hold across git autocrlf configurations.
function hashFile(path) {
  const content = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
  return createHash("sha256").update(content).digest("hex");
}

if (process.argv.includes("--update")) {
  const locked = {};
  for (const file of LOCKED_FILES) {
    locked[file] = hashFile(file);
  }
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({ locked }, null, 2)}\n`,
  );
  console.log(`[gate-integrity] pinned ${LOCKED_FILES.length} locked gate files`);
  process.exit(0);
}

if (!existsSync(MANIFEST_PATH)) {
  console.error(
    `[gate-integrity] ${MANIFEST_PATH} is missing. Locked gates cannot be verified; restore it from the template.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const problems = [];

for (const file of LOCKED_FILES) {
  const pinned = manifest.locked?.[file];
  if (!pinned) {
    problems.push(`${file}: no pin recorded in ${MANIFEST_PATH}`);
  } else if (!existsSync(file)) {
    problems.push(`${file}: locked gate file was deleted`);
  } else if (hashFile(file) !== pinned) {
    problems.push(`${file}: locked gate file was modified`);
  }
}

if (problems.length > 0) {
  console.error(`[gate-integrity] ${problems.length} locked gate violation(s):`);
  for (const problem of problems) {
    console.error(`[gate-integrity]   ${problem}`);
  }
  console.error(
    "[gate-integrity] Locked gates encode platform invariants and must not be edited by generated apps.",
  );
  console.error(
    "[gate-integrity] If a gate blocks a legitimate case: use its documented opt-out marker (EXTERNAL_CALLER, READ_ONLY_SURFACE), restructure the code to satisfy the rule, or stop and surface the conflict to the user.",
  );
  console.error(
    "[gate-integrity] The only contract file meant to be adapted is src/lib/template-state.test.mjs.",
  );
  process.exit(1);
}

console.log(`[gate-integrity] ${LOCKED_FILES.length} locked gate files verified`);
