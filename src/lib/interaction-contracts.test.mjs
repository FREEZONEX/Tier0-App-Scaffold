import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const UI_ROOTS = ["src/components", "src/routes"];

const HIGH_RISK_ACTION =
  /自动|推荐|一键|按规则|批量|发料|分配|派发|流转|冻结|释放|作废|执行|先进先出|优化|\bFIFO\b|\boptimi[sz]ed?\b|\bauto\b|\brecommend(?:ed|ation)?\b|\bone-click\b|\bbatch\b|\bassign\b|\bdispatch\b|\brelease\b|\bfreeze\b|\bexecute\b/i;

// Generic Dialog/Drawer usage is NOT transparency evidence: a page can have an
// ordinary create-form dialog and still ship an opaque one-click rule action.
const TRANSPARENT_ACTION_CONTEXT =
  /ImpactPreviewDialog|RecommendationAction|ConfirmDialog|预览|影响|确认|原因|明细|依据|受影响|例外|preview|impact|confirm|reason|detail|basis|affected|exception/i;

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

function hasInteractiveAction(source) {
  return /<button\b|<OverlayActionButton\b|<RecommendationAction\b/.test(source);
}

function actionSurface(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\bclassName=(?:"[^"]*"|'[^']*'|\{[\s\S]*?\})/g, "")
    .replace(/\bimport[\s\S]*?;\s*/g, "");
}

function isOpaqueHighRiskAction(source) {
  const surface = actionSurface(source);

  return (
    hasInteractiveAction(source) &&
    HIGH_RISK_ACTION.test(surface) &&
    !TRANSPARENT_ACTION_CONTEXT.test(surface)
  );
}

describe("interaction contracts", () => {
  it("provides generic transparent action primitives for generated rule actions", () => {
    const actionSource = readFileSync(
      join(process.cwd(), "src/components/actions/recommendation-action.tsx"),
      "utf8",
    );
    const actionIndex = readFileSync(
      join(process.cwd(), "src/components/actions/index.ts"),
      "utf8",
    );

    assert.match(actionSource, /export interface ImpactPreviewItem/);
    assert.match(actionSource, /export interface ImpactPreviewLabels/);
    assert.match(actionSource, /export function ImpactPreviewDialog/);
    assert.match(actionSource, /export function RecommendationAction/);
    assert.match(actionSource, /basis/);
    assert.match(actionSource, /impacts/);
    assert.match(actionSource, /impacts\.length/);
    assert.match(actionSource, /reason/);
    assert.match(actionIndex, /ImpactPreviewDialog/);
    assert.match(actionIndex, /RecommendationAction/);
  });

  it("treats generic dialogs as insufficient transparency for high-risk actions", () => {
    const opaque = `
      export function AllocatePanel() {
        return <button type="button" onClick={runAllocation}>自动分配</button>;
      }
    `;
    assert.equal(isOpaqueHighRiskAction(opaque), true);

    const unrelatedFormDialog = `
      import { FormDialog } from "@/components/overlays";
      export function Page() {
        return (
          <>
            <FormDialog open={open} onOpenChange={setOpen} title="编辑物料" onSubmit={save}>
              <input value={name} />
            </FormDialog>
            <button type="button" onClick={runAllocation}>自动分配</button>
          </>
        );
      }
    `;
    assert.equal(isOpaqueHighRiskAction(unrelatedFormDialog), true);

    const confirmed = `
      export function Page() {
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>批量释放</button>
            <ConfirmDialog open={open} onOpenChange={setOpen} title="确认释放选中批次" onConfirm={release} />
          </>
        );
      }
    `;
    assert.equal(isOpaqueHighRiskAction(confirmed), false);

    const recommended = `
      export function Page() {
        return <RecommendationAction label="FIFO 自动分配" basis={basis} impacts={impacts} onConfirm={run} />;
      }
    `;
    assert.equal(isOpaqueHighRiskAction(recommended), false);

    const fifoOpaque = `
      export function Page() {
        return <button type="button" onClick={applyPlan}>按 FIFO 生成拣选顺序</button>;
      }
    `;
    assert.equal(isOpaqueHighRiskAction(fifoOpaque), true);

    const optimizeOpaque = `
      export function Page() {
        return <button type="button" onClick={optimize}>优化排程</button>;
      }
    `;
    assert.equal(isOpaqueHighRiskAction(optimizeOpaque), true);
  });

  it("requires high-risk generated actions to expose confirmation, details, or impact context", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        if (isOpaqueHighRiskAction(readFileSync(file, "utf8"))) {
          offenders.push(relative(process.cwd(), file));
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Rule-driven or batch actions must include confirmation, details, reason, or impact context:\n${offenders.join("\n")}`,
    );
  });
});
