import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { PlatformTextSizeSync } from "../src/lib/platform-text-size";

const runtimeKey = Symbol.for("tier0.page-runtime.v1");
const runtimeGlobal = globalThis as Record<symbol, unknown>;

afterEach(() => {
  delete runtimeGlobal[runtimeKey];
});

test("the text size sync does not read the browser runtime during SSR", () => {
  runtimeGlobal[runtimeKey] = {
    getPlatformTextSize() {
      assert.fail("SSR must use its own initial snapshot");
    },
    on() {
      assert.fail("SSR cannot subscribe to browser events");
    },
  };
  assert.equal(renderToString(createElement(PlatformTextSizeSync)), "");
});
