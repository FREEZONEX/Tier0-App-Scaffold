import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

// App data contract: generated apps have no database. Their own business data
// lives in app-owned UNS collections (`defineAppCollection` / `ensureAppCollection`
// in src/lib/uns.server.ts); everything else in UNS is read-only for the app.

const DB_PACKAGES = [
  "pg",
  "postgres",
  "@types/pg",
  "drizzle-orm",
  "drizzle-kit",
  "drizzle-zod",
  "prisma",
  "@prisma/client",
  "mysql",
  "mysql2",
  "sqlite3",
  "better-sqlite3",
  "knex",
  "typeorm",
  "sequelize",
  "kysely",
];

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile() && /\.(tsx?|mjs|js)$/.test(entry.name) && !/\.test\.(tsx?|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceFiles() {
  return [...walkFiles("src"), ...walkFiles("scripts"), "server.mjs", "vite.config.ts"]
    .filter((file) => existsSync(file))
    .map((file) => ({ rel: toPosixPath(relative(process.cwd(), file)), source: stripComments(readFileSync(file, "utf8")) }));
}

describe("app data contracts", () => {
  it("declares no database client or ORM dependency", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const found = DB_PACKAGES.filter((name) => name in deps);
    assert.deepEqual(found, [], `Apps have no database; store app data in app-owned UNS collections. Remove: ${found.join(", ")}`);
    for (const script of Object.keys(pkg.scripts ?? {})) {
      assert.ok(!/^db:/.test(script), `package.json script "${script}" belongs to the retired app database`);
    }
  });

  it("has no database layer files", () => {
    for (const path of ["src/db", "drizzle.config.ts", "drizzle", "prisma"]) {
      assert.equal(existsSync(path), false, `${path} must not exist: apps store data in app-owned UNS collections`);
    }
  });

  it("does not import a database driver or read database env", () => {
    const offenders = [];
    const importRe = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
    for (const { rel, source } of sourceFiles()) {
      for (const match of source.matchAll(importRe)) {
        const spec = match[1];
        if (DB_PACKAGES.some((name) => spec === name || spec.startsWith(`${name}/`)) || spec === "@/db" || spec.startsWith("@/db/")) {
          offenders.push(`${rel}: imports ${spec}`);
        }
      }
      if (/\b(?:DATABASE_URL|DIRECT_DATABASE_URL|DB_SCHEMA)\b/.test(source)) {
        offenders.push(`${rel}: reads a database env variable`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("never hard-codes an app collection prefix", () => {
    const offenders = sourceFiles()
      .filter(({ rel }) => rel.startsWith("src/"))
      .filter(({ source }) => /["'`]app\.[0-9a-f]{12}\./.test(source))
      .map(({ rel }) => rel);
    assert.deepEqual(
      offenders,
      [],
      "Resolve app collection ids at runtime with appCollectionId(name) / defineAppCollection(name, …); the prefix changes when the app is imported elsewhere.",
    );
  });

  it("exposes the app-collection helpers on the UNS server client", () => {
    const source = readFileSync("src/lib/uns.server.ts", "utf8");
    for (const name of [
      "appCollectionPrefix",
      "appCollectionId",
      "listAppCollections",
      "ensureAppCollection",
      "seedAppRecords",
      "resetAppCollection",
      "defineAppCollection",
      "patchCollection",
      "deleteCollection",
      // MongoDB-style document API (records:find / update operators / locks / transact)
      "appCollection",
      "collection",
      "findRecords",
      "countRecords",
      "aggregateRecords",
      "insertManyRecords",
      "updateOneRecord",
      "findOneAndUpdateRecord",
      "bulkWriteRecords",
      "updateManyAll",
      "deleteManyAll",
      "lockRecords",
      "transact",
    ]) {
      assert.match(source, new RegExp(`export (?:async )?function\\*? ?${name}\\b`), `uns.server.ts must export ${name}`);
    }
    assert.match(source, /TIER0_APP_COLLECTION_PREFIX/);
    assert.match(source, /purge/);
  });

  it("forwards every change kind, filters and the resume position to the browser", () => {
    const route = readFileSync("src/routes/api/uns/subscribe.ts", "utf8");
    assert.match(route, /parseSubscribeRequest\(/, "the subscribe route parses kinds / filter / Last-Event-ID with parseSubscribeRequest");
    assert.match(route, /subscribeUpstream\(/);
    const server = readFileSync("src/lib/uns.server.ts", "utf8");
    for (const kind of ["delete", "lock", "leave"]) assert.match(server, new RegExp(`"${kind}"`), `subscribe must allow kinds=${kind}`);
    assert.match(server, /Last-Event-ID/);
    const live = readFileSync("src/lib/uns-live.ts", "utf8");
    assert.match(live, /"reset"/, "useUnsChanges must handle event: reset");
    assert.match(live, /ev\.full/, "record events with full: true replace the document");
  });

  it("keeps UNS credentials and the server client out of browser components", () => {
    const offenders = walkFiles("src/components")
      .map((file) => ({ rel: toPosixPath(relative(process.cwd(), file)), source: stripComments(readFileSync(file, "utf8")) }))
      .filter(({ source }) => /["']@\/lib\/uns\.server["']|TIER0_API_KEY|TIER0_APP_COLLECTION_PREFIX/.test(source))
      .map(({ rel }) => rel);
    assert.deepEqual(offenders, [], "Components call the app's own API routes; only server code uses @/lib/uns.server.");
  });
});
