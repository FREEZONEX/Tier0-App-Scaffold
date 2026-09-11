// Scaffold version marker — maintenance and validation (DO NOT modify).
//
// `package.json.tier0Scaffold` records which Tier0-App-Scaffold version an
// App was generated from. The platform reads it when an App is imported and
// prompts alignment when it is missing or differs from the current scaffold.
// Nothing at runtime depends on it.
//
//   node scripts/scaffold-version.mjs           validate; problems are warnings, exit 0
//   node scripts/scaffold-version.mjs --strict  validate; problems fail with exit 1 (scaffold CI)
//   node scripts/scaffold-version.mjs --bump    version + 1, ref = short sha of HEAD (scaffold maintainers)
//
// Apps and agents never edit the field by hand; the align-platform-app skill
// writes it after a successful alignment.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SCAFFOLD_FIELD = "tier0Scaffold";
export const SCAFFOLD_REF_PATTERN = /^[0-9a-f]{7,40}$/;

const DEFAULT_PACKAGE_PATH = "package.json";
const LOG_PREFIX = "[scaffold-version]";

function runGit(args, cwd = process.cwd()) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    available: !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: (result.stderr ?? "").trim(),
  };
}

function isNotARepository(result) {
  return result.status === 128 && /not a git repository/i.test(result.stderr);
}

/**
 * Resolve `ref` to a commit in the repository that contains `cwd`.
 *
 * Returns "resolved", "unresolved", or "skipped" (git unavailable or `cwd`
 * is not inside a git work tree).
 */
export function resolveScaffoldRef(ref, cwd = process.cwd()) {
  const result = runGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
  if (!result.available || isNotARepository(result)) {
    return "skipped";
  }
  return result.status === 0 ? "resolved" : "unresolved";
}

/** Read `package.json.tier0Scaffold`; `undefined` when the field is absent. */
export function readScaffoldVersion(packagePath = DEFAULT_PACKAGE_PATH) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  return pkg[SCAFFOLD_FIELD];
}

/**
 * Validate a `tier0Scaffold` value.
 *
 * Shape problems (missing field, non-integer version, malformed ref) are
 * always reported in `problems`. Whether `ref` resolves to a commit is checked
 * only when `resolveRef` is set; an unresolvable ref is a problem when
 * `requireResolvableRef` is set (the scaffold repository's own CI) and a
 * `note` otherwise, because an App need not carry the scaffold's git history.
 */
export function validateScaffoldVersion(value, options = {}) {
  const { resolveRef = false, requireResolvableRef = false, cwd = process.cwd() } = options;
  const problems = [];
  const notes = [];

  if (value === undefined || value === null) {
    problems.push(
      `package.json has no "${SCAFFOLD_FIELD}" field; the platform treats this App as unmarked and prompts alignment on import.`,
    );
    return { problems, notes };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    problems.push(`"${SCAFFOLD_FIELD}" must be an object with "version" and "ref".`);
    return { problems, notes };
  }

  const { version, ref } = value;
  if (!Number.isInteger(version) || version < 1) {
    problems.push(`"${SCAFFOLD_FIELD}.version" must be a positive integer (got ${JSON.stringify(version)}).`);
  }

  if (typeof ref !== "string" || !SCAFFOLD_REF_PATTERN.test(ref)) {
    problems.push(
      `"${SCAFFOLD_FIELD}.ref" must be 7 to 40 lowercase hex characters (got ${JSON.stringify(ref)}).`,
    );
  } else if (resolveRef) {
    const resolution = resolveScaffoldRef(ref, cwd);
    if (resolution === "unresolved") {
      const message = `"${SCAFFOLD_FIELD}.ref" ${ref} does not resolve to a commit in this repository.`;
      if (requireResolvableRef) {
        problems.push(message);
      } else {
        notes.push(
          `${message} This is expected when the App does not carry the scaffold's git history; the ref names a Tier0-App-Scaffold commit.`,
        );
      }
    } else if (resolution === "skipped") {
      notes.push(`ref resolution skipped: git is unavailable or this directory is not a git work tree.`);
    }
  }

  return { problems, notes };
}

function readPackage(packagePath) {
  return JSON.parse(readFileSync(packagePath, "utf8"));
}

function withScaffoldField(pkg, value) {
  // Keep the marker near the top of package.json, right after the package
  // identity keys, instead of appending it after devDependencies.
  if (SCAFFOLD_FIELD in pkg) {
    return { ...pkg, [SCAFFOLD_FIELD]: value };
  }

  const ordered = {};
  let inserted = false;
  for (const [key, entry] of Object.entries(pkg)) {
    if (!inserted && (key === "engines" || key === "scripts")) {
      ordered[SCAFFOLD_FIELD] = value;
      inserted = true;
    }
    ordered[key] = entry;
  }
  if (!inserted) {
    ordered[SCAFFOLD_FIELD] = value;
  }
  return ordered;
}

function bump(packagePath) {
  const status = runGit(["status", "--porcelain"]);
  if (!status.available) {
    console.error(`${LOG_PREFIX} git is required for --bump.`);
    return 1;
  }
  if (status.status !== 0) {
    console.error(`${LOG_PREFIX} git status failed: ${status.stderr || "unknown error"}`);
    return 1;
  }

  // Porcelain v1 lines are "XY <path>" or "XY <old> -> <new>"; keep the
  // leading status columns intact (no trim) so the first path is not clipped.
  const dirty = status.stdout
    .split("\n")
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).split(" -> ").at(-1).trim())
    .filter((path) => path !== packagePath && path !== DEFAULT_PACKAGE_PATH);
  if (dirty.length > 0) {
    console.error(`${LOG_PREFIX} refusing to bump: the working tree has uncommitted changes other than package.json:`);
    for (const path of dirty) {
      console.error(`${LOG_PREFIX}   ${path}`);
    }
    console.error(`${LOG_PREFIX} Commit the content first; the bump is its own commit and ref must name the content commit.`);
    return 1;
  }

  const head = runGit(["rev-parse", "--short=7", "HEAD"]);
  const headSha = head.stdout.trim();
  if (head.status !== 0 || !SCAFFOLD_REF_PATTERN.test(headSha)) {
    console.error(`${LOG_PREFIX} could not resolve HEAD: ${head.stderr || headSha || "unknown error"}`);
    return 1;
  }

  const pkg = readPackage(packagePath);
  const current = pkg[SCAFFOLD_FIELD];
  const currentVersion =
    current && typeof current === "object" && Number.isInteger(current.version) && current.version > 0
      ? current.version
      : 0;
  const next = { version: currentVersion + 1, ref: headSha };

  writeFileSync(packagePath, `${JSON.stringify(withScaffoldField(pkg, next), null, 2)}\n`);
  console.log(
    `${LOG_PREFIX} ${DEFAULT_PACKAGE_PATH}: ${SCAFFOLD_FIELD} v${currentVersion || "none"} -> v${next.version} (ref ${next.ref})`,
  );
  console.log(`${LOG_PREFIX} commit this as its own change, e.g. "chore(scaffold): stamp v${next.version}"`);
  return 0;
}

function validate(packagePath, strict) {
  if (!existsSync(packagePath)) {
    console.error(`${LOG_PREFIX} ${packagePath} not found.`);
    return strict ? 1 : 0;
  }

  const value = readScaffoldVersion(packagePath);
  const { problems, notes } = validateScaffoldVersion(value, {
    resolveRef: true,
    requireResolvableRef: strict,
  });

  for (const note of notes) {
    console.log(`${LOG_PREFIX} note: ${note}`);
  }

  if (problems.length === 0) {
    console.log(`${LOG_PREFIX} ok: scaffold v${value.version} (ref ${value.ref})`);
    return 0;
  }

  const level = strict ? "error" : "warning";
  for (const problem of problems) {
    console.error(`${LOG_PREFIX} ${level}: ${problem}`);
  }
  if (strict) {
    console.error(`${LOG_PREFIX} ${problems.length} problem(s); fix package.json.${SCAFFOLD_FIELD} or run --bump on a clean tree.`);
    return 1;
  }
  console.error(
    `${LOG_PREFIX} ${problems.length} warning(s); the build continues. Do not edit ${SCAFFOLD_FIELD} by hand — the platform prompts alignment on import.`,
  );
  return 0;
}

function main(argv) {
  const args = new Set(argv);
  const strict = args.has("--strict");
  const packagePath = resolve(DEFAULT_PACKAGE_PATH);

  if (args.has("--bump")) {
    return bump(packagePath);
  }

  try {
    return validate(packagePath, strict);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} ${strict ? "error" : "warning"}: validation failed: ${message}`);
    return strict ? 1 : 0;
  }
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  process.exit(main(process.argv.slice(2)));
}
