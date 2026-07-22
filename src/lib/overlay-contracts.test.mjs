import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const UI_ROOTS = ["src/components", "src/routes"];
const OVERLAY_TAGS = ["FormDialog", "Dialog", "Drawer", "ImpactPreviewDialog"];
const WIDE_OVERLAY_GRID = /\bgrid-cols-(?:[3-9]|1[0-2])\b/;
const FIXED_PIXEL_WIDTH = /\b(?:min-w|w)-\[(\d+)px\]/g;
const OVERLAY_FIXED_WIDTH_MIN = 400;

function readProjectFile(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
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

    if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function extractOverlayBlocks(source) {
  const blocks = [];

  for (const tag of OVERLAY_TAGS) {
    let from = 0;
    while (true) {
      const open = source.indexOf(`<${tag}`, from);
      if (open === -1) {
        break;
      }

      const boundary = source[open + tag.length + 1];
      if (boundary !== undefined && /[\w$]/.test(boundary)) {
        from = open + tag.length;
        continue;
      }

      const close = source.indexOf(`</${tag}>`, open);
      if (close === -1) {
        from = open + tag.length;
        continue;
      }

      blocks.push(source.slice(open, close));
      from = close + tag.length;
    }
  }

  return blocks;
}

function findOverlayLayoutViolations(source) {
  const violations = [];

  for (const block of extractOverlayBlocks(stripComments(source))) {
    const grid = block.match(WIDE_OVERLAY_GRID);
    if (grid) {
      violations.push(grid[0]);
    }

    // Fixed widths inside an explicit internal scroll viewport are the
    // sanctioned wide-data-grid pattern, so only flag them without one.
    if (!/\boverflow-x-auto\b/.test(block)) {
      for (const match of block.matchAll(FIXED_PIXEL_WIDTH)) {
        if (Number(match[1]) >= OVERLAY_FIXED_WIDTH_MIN) {
          violations.push(match[0]);
        }
      }
    }
  }

  return violations;
}

function assertClassNearToken(source, token, requiredClass, file) {
  const index = source.indexOf(token);
  assert.notEqual(index, -1, `${file} should include ${token}`);

  const window = source.slice(Math.max(0, index - 160), index + 240);
  assert.match(
    window,
    new RegExp(`\\b${requiredClass.replaceAll("-", "\\-")}\\b`),
    `${file} should keep ${requiredClass} on the ${token} element`,
  );
}

describe("overlay contracts", () => {
  it("keeps Dialog and Drawer bodies from causing horizontal overlay scroll", () => {
    for (const file of [
      "src/components/overlays/dialog.tsx",
      "src/components/overlays/drawer.tsx",
    ]) {
      const source = readProjectFile(file);

      assertClassNearToken(source, "page-y-scroll", "min-w-0", file);
      assertClassNearToken(source, "page-y-scroll", "overflow-x-hidden", file);
      assertClassNearToken(source, "page-y-scroll", "flex-1", file);
      assertClassNearToken(source, "page-y-scroll", "min-h-0", file);
    }
  });

  it("keeps overlay frames clipped while the body owns vertical scrolling", () => {
    for (const file of [
      "src/components/overlays/dialog.tsx",
      "src/components/overlays/drawer.tsx",
    ]) {
      const source = readProjectFile(file);

      assert.match(source, /\boverflow-hidden\b/, `${file} should clip the frame`);
      assert.match(source, /\bpage-y-scroll\b/, `${file} should keep body scrolling centralized`);
    }
  });

  it("keeps FormDialog forms from widening dialog bodies", () => {
    const source = readProjectFile("src/components/overlays/form-dialog.tsx");

    assertClassNearToken(source, "<form", "min-w-0", "src/components/overlays/form-dialog.tsx");
  });

  it("flags hand-rolled wide layouts inside overlay bodies only", () => {
    const squeezedGrid = `
      <FormDialog open={open} onOpenChange={setOpen} title="新建" onSubmit={save}>
        <div className="grid md:grid-cols-3 gap-4">fields</div>
      </FormDialog>
    `;
    assert.deepEqual(findOverlayLayoutViolations(squeezedGrid), ["grid-cols-3"]);

    const fixedWidth = `
      <Dialog open={open} onOpenChange={setOpen} title="详情">
        <div className="min-w-[700px]">rows</div>
      </Dialog>
    `;
    assert.deepEqual(findOverlayLayoutViolations(fixedWidth), ["min-w-[700px]"]);

    const pageLevelGrid = `
      <div className="grid grid-cols-3 gap-4">
        <FormDialog open={open} onOpenChange={setOpen} title="新建" onSubmit={save}>
          <FormGrid>fields</FormGrid>
        </FormDialog>
      </div>
    `;
    assert.deepEqual(findOverlayLayoutViolations(pageLevelGrid), []);

    const sanctionedWideGrid = `
      <Dialog open={open} onOpenChange={setOpen} title="批次明细" size="lg">
        <div className="overflow-x-auto">
          <table className="min-w-[700px]">rows</table>
        </div>
      </Dialog>
    `;
    assert.deepEqual(findOverlayLayoutViolations(sanctionedWideGrid), []);

    const narrowFixedWidth = `
      <Drawer open={open} onOpenChange={setOpen} title="筛选">
        <div className="w-[240px]">filters</div>
      </Drawer>
    `;
    assert.deepEqual(findOverlayLayoutViolations(narrowFixedWidth), []);
  });

  it("keeps generated overlay bodies free of squeezed grids and fixed pixel widths", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const violations = findOverlayLayoutViolations(readFileSync(file, "utf8"));
        if (violations.length > 0) {
          offenders.push(
            `${relative(process.cwd(), file)}: ${violations.join(", ")}`,
          );
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Overlay bodies must use FormGrid (max 2 columns) and avoid fixed pixel widths >= ${OVERLAY_FIXED_WIDTH_MIN}px unless inside an overflow-x-auto viewport:\n${offenders.join("\n")}`,
    );
  });

  it("keeps the overlay lifecycle effect keyed on open state only (issue #22)", () => {
    // Controlled forms re-render per keystroke; an inline onOpenChange gets a
    // new identity each render. If the lifecycle effect lists callbacks or
    // config in its dependency array, its cleanup runs mid-typing and the
    // focus restore steals focus from the active input.
    const source = readProjectFile("src/components/overlays/overlay-lifecycle.ts");
    const effectDeps = [...source.matchAll(/\}, \[([^\]]*)\]\);/g)].map((m) =>
      m[1]
        .split(",")
        .map((dep) => dep.trim())
        .filter(Boolean),
    );

    const badDeps = effectDeps.filter((deps) =>
      deps.some((dep) =>
        ["onOpenChange", "initialFocusRef", "closeOnEsc"].includes(dep),
      ),
    );

    assert.deepEqual(
      badDeps,
      [],
      "useOverlayLifecycle effects must not depend on onOpenChange/initialFocusRef/closeOnEsc — read them through a ref so parent re-renders cannot interrupt input focus.",
    );
  });
});
