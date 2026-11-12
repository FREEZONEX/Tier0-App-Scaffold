import assert from "node:assert/strict";
import { test } from "node:test";

import { forwardedOrigin, requestBaseUrl } from "../server-url.mjs";

const APP_ID = "b9797d5b-55cb-4223-a5c3-28a2499a4a00";
const APP_HOST = `${APP_ID}.apps-dev.tier0.cn`;

test("accepts a single forwarded host for this App", () => {
  const headers = {
    host: "10.200.6.166:5173",
    "x-forwarded-host": APP_HOST,
    "x-forwarded-proto": "https",
  };

  assert.deepEqual(forwardedOrigin(headers, APP_ID), {
    host: APP_HOST,
    proto: "https",
  });
  assert.equal(requestBaseUrl(headers, APP_ID, "0.0.0.0", 5173), `https://${APP_HOST}`);
  assert.equal(headers.host, APP_HOST, "request.url and request.headers share the public origin");
  assert.equal(headers["x-forwarded-proto"], "https");
});

test("keeps the socket Host when there is no forwarded host", () => {
  const headers = { host: "10.200.6.166:5173" };

  assert.equal(forwardedOrigin(headers, APP_ID), undefined);
  assert.equal(requestBaseUrl(headers, APP_ID, "0.0.0.0", 3000), "https://10.200.6.166:5173");
  assert.equal(headers.host, "10.200.6.166:5173");
});

test("rejects malformed, multiple and other-App forwarded hosts", () => {
  for (const value of [
    "evil.example",
    `evil.${APP_HOST}`,
    `${APP_HOST}, evil.example`,
    `${APP_HOST} extra`,
    "http://" + APP_HOST,
  ]) {
    const headers = { host: "10.200.6.166:5173", "x-forwarded-host": value };
    assert.equal(forwardedOrigin(headers, APP_ID), undefined, value);
    assert.equal(requestBaseUrl(headers, APP_ID, "0.0.0.0", 5173), "https://10.200.6.166:5173", value);
  }
});

test("accepts http only when the trusted proxy says so", () => {
  const headers = {
    host: "10.200.6.166:5173",
    "x-forwarded-host": APP_HOST,
    "x-forwarded-proto": "http",
  };

  assert.deepEqual(forwardedOrigin(headers, APP_ID), { host: APP_HOST, proto: "http" });
  assert.equal(requestBaseUrl(headers, APP_ID, "0.0.0.0", 5173), `http://${APP_HOST}`);
  assert.equal(headers["x-forwarded-proto"], "http");
});

test("invalid or missing protocol falls back to https", () => {
  for (const value of [undefined, "https", "ftp", "http, https"]) {
    const headers = {
      host: "10.200.6.166:5173",
      "x-forwarded-host": APP_HOST,
      ...(value === undefined ? {} : { "x-forwarded-proto": value }),
    };
    assert.equal(forwardedOrigin(headers, APP_ID)?.proto, "https", String(value));
  }
});

test("requires a valid App id before trusting forwarded headers", () => {
  const headers = { host: "10.200.6.166:5173", "x-forwarded-host": APP_HOST };
  for (const value of [undefined, "", "not-a-uuid"]) {
    assert.equal(forwardedOrigin(headers, value), undefined, String(value));
    assert.equal(requestBaseUrl(headers, value, "0.0.0.0", 5173), "https://10.200.6.166:5173");
  }
});
