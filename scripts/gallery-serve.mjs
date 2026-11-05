#!/usr/bin/env node
/**
 * Local static server for .output/component-gallery (component portal).
 * Usage: npm run gallery:serve
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, ".output/component-gallery");
const port = Number(process.env.GALLERY_PORT || 4335);
const host = process.env.GALLERY_HOST || "127.0.0.1";

if (!existsSync(join(dir, "index.html"))) {
  console.error(
    "Missing gallery build. Run: npm run gallery:build",
  );
  process.exit(1);
}

const child = spawn(
  "python3",
  ["-m", "http.server", String(port), "--bind", host],
  { cwd: dir, stdio: "inherit" },
);

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 0));

console.log("");
console.log("Component gallery:");
console.log(`  http://${host}:${port}/index.html`);
console.log(`  http://${host}:${port}/scaffold-library.html`);
console.log("");
console.log("Press Ctrl+C to stop.");
