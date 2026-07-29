import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const GENERATED_APP_ICON_PATH = "/app-icon.png";
const MAX_APP_ICON_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

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

  it("requires a generated app to replace the template icon with a platform-ready PNG", () => {
    const appChromeSource = readFileSync(
      join(process.cwd(), "src/lib/app-chrome.ts"),
      "utf8",
    );
    const isBlankTemplate =
      templateBlankMarkerFiles().length === 1 &&
      /APP_NAME\s*=\s*["'`]Manufacturing App["'`]/.test(appChromeSource);
    if (isBlankTemplate) {
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
});
