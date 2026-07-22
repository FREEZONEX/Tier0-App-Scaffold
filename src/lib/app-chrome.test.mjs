import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

describe("app chrome policy", () => {
  function walkRouteFiles(root) {
    const files = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const fullPath = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...walkRouteFiles(fullPath));
        continue;
      }
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("keeps workspace as the primary app chrome", () => {
    const policy = readFileSync(
      join(process.cwd(), "src/lib/app-chrome.ts"),
      "utf8",
    );

    assert.match(policy, /APP_PRIMARY_CHROME: AppChrome = "workspace"/);
    assert.match(policy, /prefix: "\/station"/);
    assert.match(policy, /prefix: "\/review"/);
    assert.match(policy, /prefix: "\/monitor"/);
  });

  it("keeps the workspace content container (layout incident guard)", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/Shell.tsx"),
      "utf8",
    );

    // Wide-monitor guard: without the centered container, tables and cards
    // stretch edge-to-edge with hollow gaps between sparse columns.
    assert.match(shell, /max-w-\[1440px\]/);
  });

  it("uses the centralized sidebar filter in Shell", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/Shell.tsx"),
      "utf8",
    );

    assert.match(shell, /filterSidebarModules/);
    assert.doesNotMatch(shell, /NO_SIDEBAR_ROUTE_PREFIXES/);
  });

  it("keeps the template blank route unique", () => {
    const routeFiles = walkRouteFiles(join(process.cwd(), "src/routes"));
    const markerFiles = routeFiles
      .filter((file) => readFileSync(file, "utf8").includes("TEMPLATE_BLANK_ROUTE"))
      .map((file) => toPosixPath(relative(process.cwd(), file)));

    assert.ok(
      markerFiles.length <= 1,
      `Only one template blank route marker is allowed:\n${markerFiles.join("\n")}`,
    );
    if (markerFiles.length === 1) {
      assert.equal(markerFiles[0], "src/routes/_app.index.tsx");
    }
  });
});
