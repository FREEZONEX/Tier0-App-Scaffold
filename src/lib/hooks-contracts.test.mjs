import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (file) => readFileSync(join(process.cwd(), file), "utf8");

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

// A load that fails must be visible in the Builder preview console. The
// preview only relays `console.error`; a fetch failure that ends up solely in
// an error state renders as "Load failed" with the real cause (a failed query,
// a missing schema) hidden in the server log.
describe("API failure visibility contracts", () => {
  it("requestJson reports non-2xx responses with the server cause, then throws", () => {
    const utils = read("src/lib/utils.ts");

    assert.match(utils, /export async function requestJson</);
    assert.match(utils, /export class ApiRequestError extends Error/);
    assert.match(utils, /readonly reported = true/);
    assert.match(utils, /parsed\.cause/);
    assert.match(utils, /console\.error\("\[api\]", error\.message\)/);
    assert.match(utils, /throw error;/);
  });

  it("hooks load through requestJson and report every other loader failure", () => {
    const hooks = read("src/lib/hooks.ts");

    assert.match(hooks, /import \{ requestJson \} from "@\/lib\/utils"/);
    assert.match(hooks, /await requestJson<T>\(url, \{ signal: controller\.signal \}\)/);
    assert.match(hooks, /function reportRequestFailure\(/);
    assert.match(hooks, /console\.error\(`\[request\] \$\{scope\} failed:`/);
    assert.equal(
      (hooks.match(/reportRequestFailure\((requestKey|url), error\)/g) ?? []).length,
      2,
      "both useRequest and usePolling must report before setError",
    );
    assert.doesNotMatch(hooks, /fetch\(apiUrl\(/, "hooks must not bypass requestJson");
  });

  it("requestJson runtime: console.error carries the cause and the throw keeps it", async () => {
    const { requestJson, ApiRequestError } = await import("./utils.ts");
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    const logged = [];
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: "Internal error",
          cause: 'Failed query: create schema if not exists "app_x"',
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    console.error = (...args) => logged.push(args.join(" "));
    try {
      await assert.rejects(
        requestJson("/api/inspections"),
        (error) =>
          error instanceof ApiRequestError &&
          error.status === 500 &&
          error.reported === true &&
          error.detail.includes("create schema if not exists"),
      );
      assert.equal(logged.length, 1);
      assert.match(logged[0], /^\[api\] HTTP 500 \/api\/inspections: Failed query: create schema/);
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalError;
    }
  });

  it("requestJson runtime: 2xx parses JSON and logs nothing", async () => {
    const { requestJson } = await import("./utils.ts");
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    let logged = 0;
    globalThis.fetch = async () => Response.json([{ id: 1 }]);
    console.error = () => {
      logged += 1;
    };
    try {
      assert.deepEqual(await requestJson("/api/items"), [{ id: 1 }]);
      assert.equal(logged, 0);
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalError;
    }
  });
});
