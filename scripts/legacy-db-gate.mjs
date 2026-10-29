// Legacy database gate — hard verification stage (DO NOT modify).
//
// App data lives in Tier0 UNS collections; the platform injects no SQL database.
// An App that still depends on a database driver/ORM, or reads database
// connection settings in src/ or server.mjs, has not finished its migration:
// convert those callers to collections (align-platform-app → SQL rewrite).
//
// A database the user explicitly keeps as an external system of record is
// declared, one entry per kept driver, in package.json:
//
//   "tier0ExternalDatabases": [
//     { "package": "pg", "env": ["ERP_PGHOST"], "reason": "User keeps the ERP database as system of record" }
//   ]
//
// Only runtime code is scanned: documentation, archived references and *.test.*
// files may still mention these settings.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXTERNAL_DATABASES_FIELD = "tier0ExternalDatabases";

export const LEGACY_DATABASE_PACKAGES = [
  "pg",
  "postgres",
  "mysql",
  "mysql2",
  "sqlite3",
  "better-sqlite3",
  "drizzle-orm",
  "prisma",
  "@prisma/client",
  "knex",
  "typeorm",
  "sequelize",
];

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const SOURCE_ROOT = "src";
const STARTUP_FILES = ["server.mjs"];
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /\.test\.(?:[cm]?[jt]sx?)$/;
const DATABASE_ENV = /\b(?:DATABASE_URL|DIRECT_DATABASE_URL|DB_SCHEMA|PG[A-Z][A-Z_]*)\b/g;
const LOG_PREFIX = "[legacy-db-gate]";

function walkFiles(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile() && SOURCE_EXTENSION.test(entry.name) && !TEST_FILE.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function readAllowlist(packageJson, problems) {
  const entries = packageJson[EXTERNAL_DATABASES_FIELD] ?? [];
  const packages = new Set();
  const env = new Set();
  if (!Array.isArray(entries)) {
    problems.push(`package.json ${EXTERNAL_DATABASES_FIELD} must be an array of { package, env?, reason }`);
    return { packages, env };
  }
  entries.forEach((entry, index) => {
    const label = `package.json ${EXTERNAL_DATABASES_FIELD}[${index}]`;
    if (typeof entry?.package !== "string" || entry.package === "") {
      problems.push(`${label}: "package" must name the kept database package`);
      return;
    }
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      problems.push(`${label}: "reason" must record why the user keeps this external database`);
      return;
    }
    if (entry.env !== undefined && !(Array.isArray(entry.env) && entry.env.every((name) => typeof name === "string"))) {
      problems.push(`${label}: "env" must be an array of environment variable names`);
      return;
    }
    packages.add(entry.package);
    for (const name of entry.env ?? []) env.add(name);
  });
  return { packages, env };
}

export function findLegacyDatabaseUsage(root = process.cwd()) {
  const problems = [];
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const allowed = readAllowlist(packageJson, problems);

  for (const field of DEPENDENCY_FIELDS) {
    for (const name of Object.keys(packageJson[field] ?? {})) {
      if (LEGACY_DATABASE_PACKAGES.includes(name) && !allowed.packages.has(name)) {
        problems.push(`package.json ${field}: "${name}" is a database driver/ORM`);
      }
    }
  }

  const files = [
    ...walkFiles(join(root, SOURCE_ROOT)),
    ...STARTUP_FILES.map((file) => join(root, file)).filter((file) => existsSync(file)),
  ];
  for (const file of files) {
    const source = stripComments(readFileSync(file, "utf8"));
    const names = new Set(source.match(DATABASE_ENV) ?? []);
    for (const name of names) {
      if (!allowed.env.has(name)) {
        problems.push(`${relative(root, file).replaceAll("\\", "/")}: reads database setting ${name}`);
      }
    }
  }

  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = findLegacyDatabaseUsage();
  if (problems.length > 0) {
    console.error(`${LOG_PREFIX} ${problems.length} legacy database dependency(ies):`);
    for (const problem of problems) console.error(`${LOG_PREFIX}   ${problem}`);
    console.error(
      `${LOG_PREFIX} App data lives in UNS collections (AGENTS.md → App Data). Convert these callers to collections and remove the driver and connection settings.`,
    );
    console.error(
      `${LOG_PREFIX} Only a database the user explicitly keeps as an external system of record may be declared in package.json ${EXTERNAL_DATABASES_FIELD}.`,
    );
    process.exit(1);
  }
  console.log(`${LOG_PREFIX} no legacy database dependencies`);
}
