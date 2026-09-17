/**
 * Real React/Chromium regression test; no application or database server needed.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/test-request-refresh.mjs
 * Uses the existing Vite toolchain; Playwright may come from the QA environment.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "vite";

const entry = "virtual:request-refresh-test.js";
const fixture = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useRequest, usePolling } from "@/lib/hooks";
import { AsyncView } from "@/components/data/async-view";
const state = { key: "a", kind: "request", options: {}, interval: 100, calls: [], hidden: false, online: true };
Object.defineProperty(document, "hidden", { configurable: true, get: () => state.hidden });
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => state.online });
function load(signal) {
  return new Promise((resolve, reject) => state.calls.push({ signal, resolve, reject }));
}
window.fetch = async (_url, init) => Response.json(await load(init.signal));
function Draft({ data }) {
  const [value, setValue] = useState("");
  return React.createElement("section", null,
    React.createElement("output", null, data.value),
    React.createElement("input", { "aria-label": "draft", value, onChange: event => setValue(event.target.value) }));
}
function View({ result }) {
  window.result = result;
  return React.createElement(AsyncView, { result }, data => React.createElement(Draft, { data }));
}
function RequestProbe() {
  return React.createElement(View, { result: useRequest(state.key, signal => load(signal), state.options) });
}
function PollProbe() {
  return React.createElement(View, { result: usePolling("/api/" + state.key, state.interval, state.options) });
}
const root = createRoot(document.getElementById("root"));
window.fixture = {
  configure(patch) { Object.assign(state, patch); root.render(React.createElement(state.kind === "request" ? RequestProbe : PollProbe)); },
  resolve(index, value) { state.calls[index].resolve({ value }); },
  reject(index) { state.calls[index].reject(new Error("Expected test outage")); },
  visibility(hidden) { state.hidden = hidden; document.dispatchEvent(new Event("visibilitychange")); },
  reconnect(online) { state.online = online; window.dispatchEvent(new Event(online ? "online" : "offline")); },
  snapshot() { return { calls: state.calls.length, aborted: state.calls.map(call => call.signal.aborted), data: window.result?.data, error: window.result?.error?.message, loading: window.result?.isLoading }; },
  unmount() { root.unmount(); },
};
window.fixture.configure({});
`;
const bundle = await build({
  configFile: false,
  logLevel: "error",
  resolve: { alias: { "@": resolve("src") } },
  plugins: [{
    name: "request-refresh-test",
    resolveId(id) { if (id === entry) return id; },
    load(id) { if (id === entry) return fixture; },
  }],
  build: {
    write: false,
    minify: false,
    rollupOptions: { input: entry, output: { format: "iife" } },
  },
});
const output = Array.isArray(bundle) ? bundle[0].output : bundle.output;
const script = output.find(chunk => chunk.type === "chunk").code;
const server = createServer((request, response) => {
  response.setHeader("content-type", request.url === "/test.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/test.js" ? script : '<div id="root"></div><script src="/test.js"></script>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const origin = `http://127.0.0.1:${server.address().port}`;
let passed = 0;
async function check(name, run) {
  const page = await browser.newPage();
  const errors = [];
  const loggedErrors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") loggedErrors.push(message.text());
  });
  await page.goto(origin);
  await page.waitForFunction(() => window.fixture?.snapshot().calls === 1);
  const count = async expected => page.waitForFunction(n => window.fixture.snapshot().calls === n, expected);
  const snapshot = () => page.evaluate(() => window.fixture.snapshot());
  const settle = async (index, value = "ready") => {
    await page.evaluate(([i, v]) => window.fixture.resolve(i, v), [index, value]);
    await page.waitForFunction(() => !window.fixture.snapshot().loading);
  };
  try {
    await run({ page, count, snapshot, settle });
    assert.deepEqual(errors, []);
    assert.deepEqual(loggedErrors.filter(message => !message.includes("Expected test outage")), []);
    console.log(`PASS ${++passed}: ${name}`);
  } finally {
    await page.close();
  }
}
try {
  await check("visible and reconnect revalidation; stable loader does not refetch on render", async ({ page, count, settle, snapshot }) => {
    await settle(0);
    await page.evaluate(() => window.fixture.configure({}));
    await page.waitForTimeout(80);
    assert.equal((await snapshot()).calls, 1);
    await page.evaluate(() => window.fixture.visibility(true));
    assert.equal((await snapshot()).calls, 1);
    await page.evaluate(() => window.fixture.visibility(false));
    await count(2); await settle(1);
    await page.evaluate(() => window.fixture.reconnect(true));
    await count(3); await settle(2);
  });
  await check("intervals skip slow requests and preserve existing data and dirty input", async ({ page, count, settle, snapshot }) => {
    await settle(0, "old");
    await page.getByLabel("draft").fill("unsaved edit");
    await page.evaluate(() => window.fixture.configure({ options: { refetchInterval: 40 } }));
    await count(2);
    await page.waitForTimeout(180);
    assert.equal((await snapshot()).calls, 2);
    assert.equal((await snapshot()).aborted[1], false);
    assert.equal(await page.locator("output").textContent(), "old");
    assert.equal(await page.getByLabel("draft").inputValue(), "unsaved edit");
    await settle(1, "updated");
    assert.equal(await page.locator("output").textContent(), "updated");
    assert.equal(await page.getByLabel("draft").inputValue(), "unsaved edit");
  });
  await check("hidden/offline intervals pause; resume catches up without losing old data", async ({ page, count, settle, snapshot }) => {
    await settle(0);
    await page.evaluate(() => { window.fixture.visibility(true); window.fixture.configure({ options: { refetchInterval: 40 } }); });
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, 1);
    await page.evaluate(() => { window.fixture.reconnect(false); window.fixture.visibility(false); });
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, 1);
    await page.evaluate(() => window.fixture.reconnect(true));
    await count(2); assert.deepEqual((await snapshot()).data, { value: "ready" });
  });
  await check("explicit refresh replaces an older request even offline; stale result is ignored", async ({ page, count, settle, snapshot }) => {
    await page.evaluate(() => { window.fixture.reconnect(false); window.result.refresh(); });
    await count(2); assert.equal((await snapshot()).aborted[0], true);
    await settle(1, "new");
    await page.evaluate(() => window.fixture.resolve(0, "late old"));
    await page.waitForTimeout(60); assert.deepEqual((await snapshot()).data, { value: "new" });
  });
  await check("disabled/unmounted hooks remove automatic work and abort requests", async ({ page, count, settle, snapshot }) => {
    await page.evaluate(() => window.fixture.configure({ options: { enabled: false, refetchInterval: 40 } }));
    await page.waitForFunction(() => !window.fixture.snapshot().loading);
    assert.equal((await snapshot()).aborted[0], true);
    await page.evaluate(() => { window.fixture.visibility(false); window.fixture.reconnect(true); });
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, 1);
    await page.evaluate(() => window.fixture.configure({ options: { enabled: true, refetchInterval: 40 } }));
    await count(2); await settle(1);
    await page.evaluate(() => window.fixture.unmount());
    const before = (await snapshot()).calls;
    await page.evaluate(() => { window.fixture.visibility(false); window.fixture.reconnect(true); });
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, before);
  });
  await check("immutable reads can opt out; interval is off by default", async ({ page, settle, snapshot }) => {
    await settle(0);
    await page.evaluate(() => window.fixture.configure({ options: { refetchOnWindowFocus: false, refetchOnReconnect: false } }));
    await page.waitForTimeout(40);
    await page.evaluate(() => { window.fixture.visibility(false); window.fixture.reconnect(true); });
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, 1);
  });
  await check("background failure retains data and input; next visible event recovers", async ({ page, count, settle, snapshot }) => {
    await settle(0, "old"); await page.getByLabel("draft").fill("draft");
    await page.evaluate(() => window.fixture.visibility(false)); await count(2);
    await page.evaluate(() => window.fixture.reject(1));
    await page.waitForFunction(() => window.fixture.snapshot().error);
    assert.equal(await page.getByLabel("draft").inputValue(), "draft");
    assert.deepEqual((await snapshot()).data, { value: "old" });
    await page.evaluate(() => window.fixture.visibility(false)); await count(3); await settle(2, "recovered");
    assert.equal((await snapshot()).error, undefined);
    assert.equal(await page.getByLabel("draft").inputValue(), "draft");
  });
  await check("polling pauses offline, catches up on reconnect, and stays single-flight", async ({ page, count, settle, snapshot }) => {
    await page.evaluate(() => { window.fixture.reconnect(false); window.fixture.configure({ kind: "polling", interval: 40 }); });
    await count(2); await settle(1);
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, 2);
    await page.evaluate(() => window.fixture.reconnect(true)); await count(3);
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, 3);
    assert.equal((await snapshot()).aborted[2], false);
    await page.evaluate(() => window.fixture.configure({ options: { enabled: false } }));
    await page.waitForFunction(() => !window.fixture.snapshot().loading);
    await page.evaluate(() => window.fixture.reconnect(true));
    await page.waitForTimeout(130); assert.equal((await snapshot()).calls, 3);
  });
  console.log(`All ${passed} browser regressions passed.`);
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
