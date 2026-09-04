import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const GENERATED_APP_ICON_PATH = "/app-icon.png";
const MAX_APP_ICON_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const TEMPLATE_ROUTE_FILES = [
  "src/routes/__root.tsx",
  "src/routes/_app.index.tsx",
  "src/routes/_app.tsx",
  "src/routes/api/auth/me.ts",
  "src/routes/api/health.ts",
  "src/routes/api/manifest.ts",
  "src/routes/login.tsx",
  "src/routes/monitor.tsx",
  "src/routes/review.tsx",
  "src/routes/station.tsx",
];
const TEMPLATE_SERVICE_FILES = [
  "src/services/bootstrap.ts",
  "src/services/db-results.ts",
  "src/services/seed-utils.ts",
];
const TEMPLATE_STATE_FINGERPRINTS = {
  "roles.json": "b2d07f68818cfc353b2f98543a018fa6ef6157026f910ad359eb7370a4b25172",
  "src/components/Shell.tsx":
    "8b755415ee11abe575fff41606d88c21fd302d80a64111286013393985a8a9c3",
  "src/components/shell-modules.ts":
    "f4723dafb7d19601437521226a7f58ccce27ac31245d07165d28bbfa6ff9a850",
  "src/db/schema.ts":
    "3967e92af2f0b5858b7aca04a9c69e7dd8f760974ae5fd9b4c57c3b7bc107cf9",
  "src/lib/app-chrome.ts":
    "e772ac721e016dcd98a848ea0159ed924c56df75677f3b0016d52210a4008ff8",
  "src/lib/permissions.ts":
    "aa704dc9ccd483bc0ace463303c1434726cbff48477cb88db7219fbc77051a6f",
  "src/lib/role-metadata.ts":
    "15aea100b5a0037ca8193f58f562717cf934e1c66ab69ee5803fa6ca8041511e",
  "src/routes/_app.index.tsx":
    "9b6c23fac6a4cba1d4c1723744cadacb35d68210146acf7432715a5aff2db131",
};

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

  function templateBlankMarkerFiles() {
    return walkRouteFiles(join(process.cwd(), "src/routes"))
      .filter((file) => readFileSync(file, "utf8").includes("TEMPLATE_BLANK_ROUTE"))
      .map((file) => toPosixPath(relative(process.cwd(), file)));
  }

  function projectFiles(root) {
    return walkRouteFiles(join(process.cwd(), root))
      .map((file) => toPosixPath(relative(process.cwd(), file)))
      .sort();
  }

  function sourceFingerprint(relativePath) {
    const filePath = join(process.cwd(), relativePath);
    if (!existsSync(filePath)) return null;
    const source = readFileSync(filePath, "utf8").replaceAll("\r\n", "\n");
    return createHash("sha256").update(source).digest("hex");
  }

  function currentTemplateState() {
    return {
      markerFiles: templateBlankMarkerFiles(),
      routeFiles: projectFiles("src/routes"),
      serviceFiles: projectFiles("src/services"),
      fingerprints: Object.fromEntries(
        Object.keys(TEMPLATE_STATE_FINGERPRINTS).map((file) => [
          file,
          sourceFingerprint(file),
        ]),
      ),
    };
  }

  function isPristineTemplateState(state) {
    const sameFiles = (actual, expected) =>
      actual.length === expected.length &&
      actual.every((file, index) => file === expected[index]);

    return (
      state.markerFiles.length === 1 &&
      state.markerFiles[0] === "src/routes/_app.index.tsx" &&
      sameFiles([...state.routeFiles].sort(), TEMPLATE_ROUTE_FILES) &&
      sameFiles([...state.serviceFiles].sort(), TEMPLATE_SERVICE_FILES) &&
      Object.entries(TEMPLATE_STATE_FINGERPRINTS).every(
        ([file, fingerprint]) => state.fingerprints[file] === fingerprint,
      )
    );
  }

  function appIconPath(appChromeSource) {
    return appChromeSource.match(
      /export const APP_ICON\s*=\s*["'`]([^"'`]+)["'`]/,
    )?.[1];
  }

  function readGeneratedAppIcon(iconPath) {
    const filePath = join(process.cwd(), "public", iconPath.slice(1));
    assert.ok(
      existsSync(filePath),
      `Generated app icon is missing: ${filePath}`,
    );
    return readFileSync(filePath);
  }

  function assertGeneratedAppIcon(
    appChromeSource,
    readIcon = readGeneratedAppIcon,
  ) {
    const iconPath = appIconPath(appChromeSource);
    assert.equal(
      iconPath,
      GENERATED_APP_ICON_PATH,
      "Generated apps must set APP_ICON to /app-icon.png, then sync public/app-icon.png to the platform with update_app_info(icon_path).",
    );

    const icon = readIcon(iconPath);
    assert.ok(icon.length > 24, "public/app-icon.png is not a complete PNG file.");
    assert.ok(
      icon.length <= MAX_APP_ICON_BYTES,
      "public/app-icon.png must not exceed 2 MB.",
    );
    assert.deepEqual(
      icon.subarray(0, PNG_SIGNATURE.length),
      PNG_SIGNATURE,
      "public/app-icon.png must contain PNG image data.",
    );
    assert.equal(
      icon.toString("ascii", 12, 16),
      "IHDR",
      "public/app-icon.png is missing its PNG IHDR header.",
    );

    const width = icon.readUInt32BE(16);
    const height = icon.readUInt32BE(20);
    assert.equal(width, 512, "public/app-icon.png must be 512 px wide.");
    assert.equal(height, 512, "public/app-icon.png must be 512 px high.");
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

  it("keeps responsive page-shell padding available to generated workspace pages", () => {
    const styles = readFileSync(
      join(process.cwd(), "src/styles/globals.css"),
      "utf8",
    );
    const agents = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");

    assert.match(
      styles,
      /\.page-shell\s*\{[^}]*min-width:\s*0;[^}]*padding:\s*var\(--tier0-space-lg\)\s+var\(--tier0-space-md\);[^}]*\}/s,
    );
    assert.match(styles, /\.page-shell\s*>\s*\*\s*\{[^}]*min-width:\s*0;/s);
    assert.match(
      styles,
      /@media\s*\(min-width:\s*640px\)\s*\{\s*\.page-shell\s*\{[^}]*padding:\s*var\(--tier0-space-xl\);/s,
    );
    assert.match(
      styles,
      /@media\s*\(min-width:\s*1024px\)\s*\{\s*\.page-shell\s*\{[^}]*padding:\s*var\(--tier0-space-xxl\);/s,
    );
    assert.match(agents, /className="page-shell/);
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
    const markerFiles = templateBlankMarkerFiles();

    assert.ok(
      markerFiles.length <= 1,
      `Only one template blank route marker is allowed:\n${markerFiles.join("\n")}`,
    );
    if (markerFiles.length === 1) {
      assert.equal(markerFiles[0], "src/routes/_app.index.tsx");
    }
  });

  it("limits the default-icon exemption to the untouched scaffold", () => {
    const pristine = {
      markerFiles: ["src/routes/_app.index.tsx"],
      routeFiles: [...TEMPLATE_ROUTE_FILES],
      serviceFiles: [...TEMPLATE_SERVICE_FILES],
      fingerprints: { ...TEMPLATE_STATE_FINGERPRINTS },
    };

    assert.equal(isPristineTemplateState(pristine), true);
    assert.equal(
      isPristineTemplateState({
        ...pristine,
        routeFiles: [...pristine.routeFiles, "src/routes/_app.inventory.tsx"],
      }),
      false,
      "A stale TEMPLATE_BLANK_ROUTE marker must not exempt a generated business route.",
    );
    assert.equal(
      isPristineTemplateState({
        ...pristine,
        fingerprints: {
          ...pristine.fingerprints,
          "src/lib/app-chrome.ts": "generated-app-chrome",
        },
      }),
      false,
      "Changing app identity must require a generated icon.",
    );
  });

  it("requires a generated app to replace the template icon with a platform-ready PNG", () => {
    const appChromeSource = readFileSync(
      join(process.cwd(), "src/lib/app-chrome.ts"),
      "utf8",
    );
    if (isPristineTemplateState(currentTemplateState())) {
      return;
    }

    assertGeneratedAppIcon(appChromeSource);
  });

  it("rejects generated app icon placeholders and malformed assets", () => {
    const validHeader = Buffer.alloc(25);
    PNG_SIGNATURE.copy(validHeader);
    validHeader.write("IHDR", 12, "ascii");
    validHeader.writeUInt32BE(512, 16);
    validHeader.writeUInt32BE(512, 20);

    assert.throws(
      () =>
        assertGeneratedAppIcon(
          'export const APP_ICON = "/app-icon.svg";',
          () => validHeader,
        ),
      /must set APP_ICON to \/app-icon\.png/,
    );
    assert.throws(
      () =>
        assertGeneratedAppIcon(
          'export const APP_ICON = "/app-icon.png";',
          () => {
            const nonSquare = Buffer.from(validHeader);
            nonSquare.writeUInt32BE(256, 20);
            return nonSquare;
          },
        ),
      /must be 512 px high/,
    );
    assert.doesNotThrow(() =>
      assertGeneratedAppIcon(
        'export const APP_ICON = "/app-icon.png";',
        () => validHeader,
      ),
    );
  });

  it("allows deterministic coded artwork for the required app icon", () => {
    const agents = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");

    assert.match(agents, /Coded artwork is allowed/);
    assert.match(agents, /SVG,\s*Canvas,\s*Node,\s*HTML\/browser rendering/);
    assert.match(agents, /public\/app-icon\.png.*512×512/s);
    assert.doesNotMatch(agents, /image-generation capability/);
    assert.doesNotMatch(
      agents,
      /incomplete rather than substituting coded artwork/,
    );
  });
});
