// Non-blocking UI quality advisories. Printed after the hard verification
// stages; never fails the build. Hard gates enforce structure, advisories
// surface judgment-level suggestions the generating agent can act on.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PAGE_ROOT = "src/routes";
const FLAT_SURFACE_THRESHOLD = 4;
const EMPHASIS_CLASS = /highlight|success|warning|destructive|info|accent/i;

function walkFiles(root) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

// Only class attribute contents count: scanning whole files would trip on
// incidental words like `catch (error)`.
function classSurface(source) {
  const matches = [
    ...source.matchAll(/className="([^"]*)"/g),
    ...source.matchAll(/className='([^']*)'/g),
    ...source.matchAll(/className=\{`([^`]*)`\}/g),
    ...source.matchAll(/className=\{cn\(([\s\S]*?)\)\}/g),
  ];

  return matches.map((match) => match[1] ?? "").join(" ");
}

const advisories = [];

if (existsSync(PAGE_ROOT) && statSync(PAGE_ROOT).isDirectory()) {
  for (const file of walkFiles(PAGE_ROOT)) {
    const classes = classSurface(readFileSync(file, "utf8"));
    const surfaces = classes.match(/\bbg-card\b/g)?.length ?? 0;

    if (surfaces >= FLAT_SURFACE_THRESHOLD && !EMPHASIS_CLASS.test(classes)) {
      advisories.push(
        `${relative(process.cwd(), file)}: ${surfaces} bg-card surfaces and no highlight/semantic accent classes - give the page one visual center (active state, semantic status color, or a dominant work surface).`,
      );
    }
  }

  // Workspace pages that neither load data nor offer any action are static
  // stubs. Station/review/monitor surfaces are excluded: read-only is
  // legitimate there. The template blank route is excluded by its marker.
  //
  // Data loading and user actions are deliberately separate signals: a page
  // that only fetches rows is a read-only surface, and a workspace full of
  // read-only surfaces delivers zero write capability even though every
  // fetch-based check passes. Pages that are intentionally read-only
  // (monitors, reports) declare it with a READ_ONLY_SURFACE comment.
  const DATA_AFFORDANCE = /apiUrl\(|useRequest\(|usePolling\(|fetch\(/;
  const ACTION_AFFORDANCE =
    /<FormDialog|<Drawer\b|<ConfirmDialog|<RecommendationAction|<ImpactPreviewDialog|onSubmit=|createServerFn|method:\s*["'`](?:POST|PUT|PATCH|DELETE)/;

  for (const file of walkFiles(PAGE_ROOT)) {
    const name = relative(process.cwd(), file).replaceAll("\\", "/");
    if (!/src\/routes\/_app\./.test(name)) {
      continue;
    }

    const source = readFileSync(file, "utf8");
    if (source.includes("TEMPLATE_BLANK_ROUTE")) {
      continue;
    }

    const loadsData = DATA_AFFORDANCE.test(source);
    const hasAction = ACTION_AFFORDANCE.test(source);

    if (!loadsData && !hasAction) {
      advisories.push(
        `${name}: workspace page has no data loading or user action - it will read as a static stub. Wire it to real data or give it an operable action.`,
      );
    } else if (!hasAction && !source.includes("READ_ONLY_SURFACE")) {
      advisories.push(
        `${name}: page loads data but offers no user action - it delivers a read-only surface. Expose the page's primary action (create/edit/submit/confirm), or mark an intentional monitor/report page with a READ_ONLY_SURFACE comment stating why.`,
      );
    }
  }

  // Template test fixtures must not survive into delivered apps. The platform
  // role-switch fixtures (老板 / test_role_a / test_role_b) ship with the
  // template for gateway verification and will appear in every generated app
  // until the agent replaces them with the product's real business roles.
  const permissionsPath = join(process.cwd(), "src/lib/permissions.ts");
  if (existsSync(permissionsPath)) {
    const permissionsSource = readFileSync(permissionsPath, "utf8");
    if (/test_role_a|test_role_b|老板/.test(permissionsSource)) {
      advisories.push(
        "src/lib/permissions.ts: template test roles (老板/test_role_a/test_role_b) are still registered - replace them with the app's real business roles in permissions.ts, role-metadata.ts, and roles.json before delivery.",
      );
    }
  }

  // Core first-version capabilities should be discoverable from the primary
  // workspace shell. Generated station/review routes are valid when the app
  // truly needs a dedicated no-sidebar surface, but hiding them from the
  // workspace makes the product feel incomplete.
  const shellPath = join(process.cwd(), "src/components/Shell.tsx");
  const shellSource = existsSync(shellPath) ? readFileSync(shellPath, "utf8") : "";

  for (const file of walkFiles(PAGE_ROOT)) {
    const name = relative(process.cwd(), file).replaceAll("\\", "/");
    const match = name.match(/^src\/routes\/(station|review)\.(.+)\.tsx$/);
    if (!match) {
      continue;
    }

    const routePath = `/${match[1]}/${match[2]
      .replace(/\/index$/, "")
      .replace(/\./g, "/")
      .replace(/\$([^/]+)/g, ":$1")}`;

    if (!shellSource.includes(routePath)) {
      advisories.push(
        `${name}: ${routePath} is a no-sidebar task route without a matching Shell entry - expose a workspace entry/link for committed first-version capabilities or implement the flow as an _app workspace page.`,
      );
    }
  }
}

function walkAllFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function countMatches(root, filePattern, regex) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return 0;
  }

  let count = 0;
  for (const file of walkAllFiles(root)) {
    if (!filePattern.test(file)) {
      continue;
    }
    count += readFileSync(file, "utf8").match(regex)?.length ?? 0;
  }
  return count;
}

const pageCount = existsSync(PAGE_ROOT)
  ? walkFiles(PAGE_ROOT).filter((f) => !/routes[\\/]api[\\/]/.test(f)).length
  : 0;
const writeHandlers = countMatches(
  "src/routes/api",
  /\.ts$/,
  /\b(?:POST|PUT|PATCH|DELETE):/g,
);
const seedCallbacks = countMatches("src/services", /\.ts$/, /\bseed:\s/g);
const enumStates = countMatches("src/db", /schema\.ts$/, /pgEnum\(/g);

console.log(
  `[advisory] delivery: ${pageCount} page routes, ${writeHandlers} write handlers, ${seedCallbacks} bootstrap seed callbacks, ${enumStates} status enums`,
);

if (advisories.length > 0) {
  console.log(`[advisory] ${advisories.length} non-blocking UI suggestion(s):`);
  for (const line of advisories) {
    console.log(`[advisory] ${line}`);
  }
  console.log(
    "[advisory] advisories never fail the build; address them when they fit the current slice",
  );
} else {
  console.log("[advisory] no UI advisories");
}
