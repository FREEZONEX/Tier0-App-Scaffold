import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { findLegacyDatabaseUsage } from "../../scripts/legacy-db-gate.mjs";

// Legacy database gate contract: App data lives in UNS collections, so a
// database driver/ORM dependency or a database connection setting read in
// src/ or server.mjs fails the build. Only a database the user keeps as an
// external system of record passes, declared in package.json
// tier0ExternalDatabases. Mentions in docs or archived references are fine.

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fixture(packageJson, files = {}) {
  const root = mkdtempSync(join(tmpdir(), "legacy-db-gate-"));
  roots.push(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", ...packageJson }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe("legacy database gate", () => {
  it("fails the build step with exit 1 and passes a clean App with exit 0", () => {
    const script = join(process.cwd(), "scripts/legacy-db-gate.mjs");
    const blocked = spawnSync(process.execPath, [script], { cwd: fixture({ dependencies: { pg: "^8.0.0" } }), encoding: "utf8" });
    assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
    const clean = spawnSync(process.execPath, [script], { cwd: fixture({}), encoding: "utf8" });
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  });

  it("fails on a database driver dependency", () => {
    const root = fixture({ dependencies: { pg: "^8.0.0" } });
    assert.match(findLegacyDatabaseUsage(root).join("\n"), /"pg" is a database driver/);
  });

  it("fails on an ORM in devDependencies", () => {
    const root = fixture({ devDependencies: { "drizzle-orm": "^0.30.0" } });
    assert.match(findLegacyDatabaseUsage(root).join("\n"), /"drizzle-orm"/);
  });

  for (const [field, name] of [
    ["dependencies", "pg-promise"],
    ["dependencies", "kysely"],
    ["dependencies", "@neondatabase/serverless"],
    ["devDependencies", "drizzle-kit"],
  ]) {
    it(`fails on ${name} in ${field}`, () => {
      const root = fixture({ [field]: { [name]: "1.0.0" } });
      assert.match(findLegacyDatabaseUsage(root).join("\n"), new RegExp(`${field}: "${name}"`));
    });
  }

  it("fails on each form of reading a database setting, including name variants", () => {
    const root = fixture(
      {},
      {
        "src/a.ts": "const a = process.env.DATABASE_URL_UNPOOLED;\nconst b = process.env['POSTGRES_URL'];\n",
        "src/b.ts": "const c = import.meta.env.DIRECT_DATABASE_URL;\nconst { DATABASE_URL: url, PGUSER } = process.env;\n",
      },
    );
    const problems = findLegacyDatabaseUsage(root).join("\n");
    for (const name of ["DATABASE_URL_UNPOOLED", "POSTGRES_URL", "DIRECT_DATABASE_URL", "DATABASE_URL", "PGUSER"]) {
      assert.match(problems, new RegExp(`reads database setting ${name}\\b`));
    }
  });

  it("fails on optional chaining", () => {
    const root = fixture({}, { "src/a.ts": "const a = process.env?.DATABASE_URL;\nconst b = process.env?.['PGHOST'];\n" });
    const problems = findLegacyDatabaseUsage(root).join("\n");
    assert.match(problems, /reads database setting DATABASE_URL\b/);
    assert.match(problems, /reads database setting PGHOST\b/);
  });

  it("fails on destructuring with a type annotation", () => {
    const root = fixture({}, { "src/a.ts": "const { DB_SCHEMA }: NodeJS.ProcessEnv = process.env;\n" });
    assert.match(findLegacyDatabaseUsage(root).join("\n"), /reads database setting DB_SCHEMA\b/);
  });

  it("fails on a member access continued on the next line", () => {
    const root = fixture({}, { "src/a.ts": "const c = process.env\n  .POSTGRES_URL;\n" });
    assert.match(findLegacyDatabaseUsage(root).join("\n"), /reads database setting POSTGRES_URL\b/);
  });

  it("still finds a read between strings that contain /* and */", () => {
    const root = fixture({}, { "src/a.ts": 'const g = "assets/*";\nconst u = process.env.DATABASE_URL;\nconst h = "*/";\n' });
    assert.match(findLegacyDatabaseUsage(root).join("\n"), /reads database setting DATABASE_URL/);
  });

  it("allows look-alike names and mentions that are not environment reads", () => {
    const root = fixture(
      {},
      {
        "src/a.ts": [
          'export const tip = "PGUP / PGDN to scroll";',
          "export const PGRANK = 1;",
          'export const help = "No DATABASE_URL needed";',
          "const x = 1; // was DATABASE_URL",
          "const host = process.env.ERP_HOST;",
        ].join("\n"),
      },
    );
    assert.deepEqual(findLegacyDatabaseUsage(root), []);
  });

  it("fails when src/ reads DATABASE_URL", () => {
    const root = fixture({}, { "src/db/client.ts": "export const url = process.env.DATABASE_URL;\n" });
    assert.match(findLegacyDatabaseUsage(root).join("\n"), /src\/db\/client\.ts: reads database setting DATABASE_URL/);
  });

  it("fails when the startup script reads PG* or DB_SCHEMA", () => {
    const root = fixture({}, { "server.mjs": 'const { PGHOST } = process.env;\nconst schema = process.env["DB_SCHEMA"];\n' });
    const problems = findLegacyDatabaseUsage(root).join("\n");
    assert.match(problems, /server\.mjs: reads database setting PGHOST/);
    assert.match(problems, /server\.mjs: reads database setting DB_SCHEMA/);
  });

  it("passes a database declared as a kept external system of record", () => {
    const root = fixture(
      {
        dependencies: { pg: "^8.0.0" },
        tier0ExternalDatabases: [{ package: "pg", env: ["PGHOST"], reason: "User keeps the ERP database" }],
      },
      { "src/services/erp.ts": "const host = process.env.PGHOST;\n" },
    );
    assert.deepEqual(findLegacyDatabaseUsage(root), []);
  });

  it("rejects a declaration without a reason", () => {
    const root = fixture({ dependencies: { pg: "^8.0.0" }, tier0ExternalDatabases: [{ package: "pg" }] });
    const problems = findLegacyDatabaseUsage(root).join("\n");
    assert.match(problems, /"reason" must record/);
    assert.match(problems, /"pg" is a database driver/);
  });

  it("ignores docs, archived references and tests", () => {
    const root = fixture(
      {},
      {
        "docs/legacy-database.md": "The old app read DATABASE_URL and used pg.\n",
        "archive/old-src/db.ts": "export const url = process.env.DATABASE_URL;\n",
        "src/lib/migration.test.mjs": 'assert.doesNotMatch(source, /DATABASE_URL|PGHOST/);\n',
        "src/data/collections.ts": "// Replaced the old DATABASE_URL / PGHOST connection.\nexport const collections = [];\n",
      },
    );
    assert.deepEqual(findLegacyDatabaseUsage(root), []);
  });
});
