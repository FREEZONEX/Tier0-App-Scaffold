import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeRepoResponsive,
  analyzeSource,
  NARROW_VIEWPORT_PX,
} from "../../scripts/responsive-contract.mjs";

const rules = (source) => analyzeSource(source).map((v) => v.rule);

describe("responsive contracts", () => {
  it("keeps the scaffold itself usable at the narrow viewport", () => {
    assert.deepEqual(analyzeRepoResponsive(), []);
  });

  describe("search and filter controls stay bounded", () => {
    it("rejects a search input that grows without an upper bound", () => {
      const violations = analyzeSource(`
        export function Toolbar() {
          return (
            <div className="flex items-center gap-2">
              <input className="h-8 flex-1" placeholder="Search" />
              <button>New</button>
            </div>
          );
        }
      `);

      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "unbounded-control-growth");
      assert.match(violations[0].message, /max-w-xs/);
    });

    it("accepts a bounded search input that shares a row", () => {
      assert.deepEqual(
        rules(`
          export function Toolbar() {
            return <input className="h-8 min-w-0 flex-1 max-w-sm" placeholder="Search" />;
          }
        `),
        [],
      );
    });

    it("accepts a search input sized without flex growth", () => {
      assert.deepEqual(
        rules(`
          export function Toolbar() {
            return <input className="h-8 w-full max-w-xs" placeholder="Search" />;
          }
        `),
        [],
      );
    });

    it("applies to selects and textareas, not only inputs", () => {
      assert.deepEqual(
        rules(`
          export function Filters() {
            return (
              <div className="flex gap-2">
                <select className="grow" />
                <textarea className="flex-1" />
              </div>
            );
          }
        `),
        ["unbounded-control-growth", "unbounded-control-growth"],
      );
    });

    it("leaves layout containers alone — only form controls are bounded", () => {
      // flex-1 on a layout div is the normal way to fill remaining space.
      assert.deepEqual(
        rules(`
          export function Page() {
            return <main className="min-h-0 flex-1">{null}</main>;
          }
        `),
        [],
      );
    });
  });

  describe("minimum widths must not break the narrow viewport", () => {
    it("rejects a hard minimum width outside any scroll region", () => {
      const violations = analyzeSource(`
        export function Panel() {
          return <div className="flex min-w-[720px] flex-col gap-8">{null}</div>;
        }
      `);

      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, "min-width-breaks-narrow-viewport");
      assert.match(violations[0].message, /720px/);
      assert.match(violations[0].message, new RegExp(String(NARROW_VIEWPORT_PX)));
    });

    it("accepts the same minimum width inside a horizontal scroll viewport", () => {
      // 这正是 TableViewport 的写法：宽度需求被限制在局部滚动区内。
      assert.deepEqual(
        rules(`
          export function TableViewport({ children }) {
            return (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[720px]">{children}</div>
              </div>
            );
          }
        `),
        [],
      );
    });

    it("resolves the tailwind spacing scale, not just arbitrary values", () => {
      // min-w-96 = 96 * 4px = 384px > 375px
      assert.deepEqual(rules(`export const A = () => <div className="min-w-96" />;`), [
        "min-width-breaks-narrow-viewport",
      ]);
      // min-w-80 = 320px, fits with room for page padding
      assert.deepEqual(rules(`export const B = () => <div className="min-w-80" />;`), []);
    });

    it("resolves rem units", () => {
      // 25rem = 400px > 375px
      assert.deepEqual(rules(`export const C = () => <div className="min-w-[25rem]" />;`), [
        "min-width-breaks-narrow-viewport",
      ]);
    });

    it("reads classes composed through cn() and template strings", () => {
      assert.deepEqual(
        rules(`export const D = () => <div className={cn("flex", "min-w-[800px]")} />;`),
        ["min-width-breaks-narrow-viewport"],
      );
      assert.deepEqual(
        rules("export const E = () => <div className={`flex min-w-[800px] ${extra}`} />;"),
        ["min-width-breaks-narrow-viewport"],
      );
    });

    it("still sees the scroll ancestor when its class list is composed", () => {
      assert.deepEqual(
        rules(`
          export const F = ({ className }) => (
            <div className={cn("w-full overflow-x-auto", className)}>
              <div className="min-w-[720px]" />
            </div>
          );
        `),
        [],
      );
    });
  });
});
