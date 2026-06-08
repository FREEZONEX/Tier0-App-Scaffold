import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("request hook contracts", () => {
  it("provides a stable-key useRequest hook", () => {
    const hooks = readFileSync(join(process.cwd(), "src/lib/hooks.ts"), "utf8");

    assert.match(hooks, /export function useRequest/);
    assert.match(hooks, /requestKey: string/);
    assert.match(hooks, /const loaderRef = useRef\(loader\)/);
    assert.match(hooks, /loaderRef\.current = loader/);
    assert.match(hooks, /controllerRef\.current\?\.abort\(\)/);
    assert.match(hooks, /refreshToken/);
  });

  it("keeps polling single-flight and hidden-tab aware", () => {
    const hooks = readFileSync(join(process.cwd(), "src/lib/hooks.ts"), "utf8");

    assert.match(hooks, /inFlightRef/);
    assert.match(hooks, /if \(inFlightRef\.current\) \{/);
    assert.match(hooks, /document\.hidden/);
    assert.match(hooks, /visibilitychange/);
    assert.match(hooks, /window\.clearInterval/);
  });
});
