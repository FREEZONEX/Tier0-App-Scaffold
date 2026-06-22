// Sync the tier0-sdk agent skill from the installed @tier0/sdk package.
//
// @tier0/sdk ships its agent skill (with the monoapptemplate/TanStack Start
// lazy-loading integration baked in) under `skills/tier0-sdk`. We copy it into
// `.agents/skills/tier0-sdk` so the skill always matches the installed SDK
// version. Runs from the `postinstall` hook; the copied dir is gitignored.
//
// We copy (not symlink) so the real files survive zipping/exporting without a
// live node_modules. Do not hand-edit `.agents/skills/tier0-sdk` — it is
// overwritten on every install.
import { existsSync, rmSync, cpSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@tier0/sdk/skills/tier0-sdk");
const dest = join(root, ".agents/skills/tier0-sdk");

// SDK not installed yet (optional dep / --ignore-scripts / partial install):
// exit 0 so `npm install` never fails because of this sync.
if (!existsSync(src)) {
  console.log("[sync-tier0-skill] @tier0/sdk skills not found — skipping.");
  process.exit(0);
}

let version = "unknown";
try {
  version = JSON.parse(
    readFileSync(join(root, "node_modules/@tier0/sdk/package.json"), "utf8"),
  ).version;
} catch {
  // ignore — version is informational only
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(
  `[sync-tier0-skill] synced tier0-sdk skill from @tier0/sdk@${version} into .agents/skills/tier0-sdk`,
);
