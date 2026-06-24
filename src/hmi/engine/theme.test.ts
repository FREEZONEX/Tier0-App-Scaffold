import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPalette, readPalette, PALETTES } from "./theme";

describe("getPalette", () => {
  it("light/dark 各含全部角色键", () => {
    const keys = ["canvas", "stroke", "fillLight", "fillDeep", "liquid", "text", "textMuted", "alarm", "running", "interlock", "selection", "stale", "badgeFg"];
    for (const mode of ["light", "dark"] as const) {
      for (const k of keys) {
        assert.equal(typeof PALETTES[mode][k as keyof (typeof PALETTES)["light"]], "string");
      }
    }
  });
  it("light 与 dark 的 canvas 底色不同", () => {
    assert.notEqual(getPalette("light").canvas, getPalette("dark").canvas);
  });
});

describe("readPalette", () => {
  it("读 CSS 变量，缺失的角色回落硬编码", () => {
    const vars: Record<string, string> = { "--hmi-canvas": "#111111", "--hmi-alarm": "#ff0000" };
    const p = readPalette((n) => vars[n] ?? "", "light");
    assert.equal(p.canvas, "#111111"); // 来自 CSS
    assert.equal(p.alarm, "#ff0000"); // 来自 CSS
    assert.equal(p.stroke, PALETTES.light.stroke); // 回落
  });
  it("全空时等价于 getPalette(mode)", () => {
    assert.deepEqual(readPalette(() => "", "dark"), PALETTES.dark);
  });
});
