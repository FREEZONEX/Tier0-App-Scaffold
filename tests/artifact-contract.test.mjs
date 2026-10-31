import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const artifact = readFileSync("artifact.toml", "utf8");

// Design 21.19. The platform parses this file in sbx-build; the checks here keep
// the Scaffold's values in step with its build output.
test("the app layer holds what `node server.mjs` needs", () => {
  assert.match(artifact, /^include = \["dist", "server\.mjs"\]$/mu);
  assert.match(artifact, /^outputDir = "\."$/mu);
  assert.match(artifact, /^args = \["node", "server\.mjs"\]$/mu);
  assert.ok(existsSync("server.mjs"));
});

test("the static bundle names the client build and its hashed assets", () => {
  assert.match(artifact, /^\[static\]\ndir = "dist\/client"\nurl_prefixes = \["\/assets\/"\]$/mu);
  assert.match(readFileSync("server.mjs", "utf8"), /dist.*client|"client"/u);
});

test("the App stays on the platform's defaults for what v1 refuses", () => {
  assert.doesNotMatch(artifact, /^\s*image\s*=/mu);
  assert.doesNotMatch(artifact, /serve = "static"/u);
});
