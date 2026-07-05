import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const ROOTS = ["src/components", "src/routes", "src/lib"];
const INTERVAL_ALLOWLIST = new Set(["src/lib/hooks.ts"]);

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function walkFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("runtime safety contracts", () => {
  it("keeps polling and timers inside the shared hook layer", () => {
    const offenders = [];

    for (const root of ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const rel = toPosixPath(relative(process.cwd(), file));
        if (INTERVAL_ALLOWLIST.has(rel)) {
          continue;
        }

        const source = readFileSync(file, "utf8");
        if (/\b(?:window\.)?setInterval\s*\(/.test(source)) {
          offenders.push(rel);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Keep repeated timers inside src/lib/hooks.ts:\n${offenders.join("\n")}`,
    );
  });

  it("does not leave client event listeners without same-file cleanup", () => {
    const offenders = [];

    for (const root of ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const rel = toPosixPath(relative(process.cwd(), file));
        const source = readFileSync(file, "utf8");
        if (!/addEventListener\s*\(/.test(source)) {
          continue;
        }

        if (!/removeEventListener\s*\(/.test(source)) {
          offenders.push(rel);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Files adding listeners must also remove them:\n${offenders.join("\n")}`,
    );
  });

  it("avoids ad hoc effect-driven fetch loops outside the shared request hooks", () => {
    const offenders = [];

    for (const root of ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const rel = toPosixPath(relative(process.cwd(), file));
        if (rel === "src/lib/hooks.ts") {
          continue;
        }

        const source = readFileSync(file, "utf8");
        const hasEffect = /useEffect\s*\(/.test(source);
        const hasFetch = /\bfetch\s*\(/.test(source);
        const usesSharedHook = /\buseRequest\s*\(|\busePolling\s*\(/.test(source);
        const hasAbort = /\bAbortController\b/.test(source);

        if (hasEffect && hasFetch && !usesSharedHook && !hasAbort) {
          offenders.push(rel);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      [
        "Effect-driven fetches must use useRequest/usePolling or explicit AbortController cleanup.",
        ...offenders,
      ].join("\n"),
    );
  });
});
