import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

// A mutation endpoint nobody can reach from the UI is a silently downgraded
// capability: the completion report claims "create order" works, the API
// exists, but no page exposes a button that calls it. Data loading alone does
// not make a capability operable — this gate closes that hole.
const API_ROOT = "src/routes/api";
const SRC_ROOT = "src";
const MUTATION_HANDLER = /^\s*(?:POST|PUT|PATCH|DELETE)\s*:/m;
// Scaffold-owned platform endpoints; generated business pages never call these.
const SCAFFOLD_PATHS = [/^\/api\/auth\//, /^\/api\/manifest$/, /^\/api\/health$/];
// Endpoints legitimately called by external systems (webhooks, platform
// callbacks, device pushes) carry an EXTERNAL_CALLER comment naming the
// caller, e.g. `// EXTERNAL_CALLER: WMS ships status callbacks to this route`.
const EXTERNAL_CALLER_MARKER = "EXTERNAL_CALLER";

function walkFiles(root, extension) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, extension));
    } else if (entry.isFile() && extension.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// "/api/crm/orders/$orderId/send" -> ["api", "crm", "orders", "*", "send"]
function routeSegments(routePath) {
  return routePath
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith("$") ? "*" : segment));
}

// "`/api/crm/orders/${order.id}/send`" -> ["api", "crm", "orders", "*", "send"]
function usageSegments(argument) {
  return argument
    .replace(/\$\{[^}]*\}/g, "*")
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.includes("*") ? "*" : segment));
}

function segmentsMatch(route, usage) {
  if (route.length !== usage.length) {
    return false;
  }
  return route.every(
    (segment, i) => segment === "*" || usage[i] === "*" || segment === usage[i],
  );
}

function collectApiUsages() {
  const usages = [];
  for (const file of walkFiles(join(process.cwd(), SRC_ROOT), /\.(ts|tsx)$/)) {
    const name = relative(process.cwd(), file).replaceAll("\\", "/");
    if (name.startsWith(`${API_ROOT}/`)) {
      continue; // the defining side does not count as a caller
    }
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/apiUrl\(\s*[`"']([^`"']+)[`"']/g)) {
      usages.push({ file: name, segments: usageSegments(match[1]) });
    }
  }
  return usages;
}

describe("write-path reachability contracts", () => {
  it("matches parameterized routes against template-literal usages", () => {
    assert.equal(
      segmentsMatch(
        routeSegments("/api/crm/orders/$orderId/send"),
        usageSegments("/api/crm/orders/${order.id}/send"),
      ),
      true,
    );
    assert.equal(
      segmentsMatch(
        routeSegments("/api/crm/orders/$orderId/send"),
        usageSegments("/api/crm/orders"),
      ),
      false,
    );
  });

  it("requires every mutation API route to be reachable from the UI", () => {
    const apiRootPath = join(process.cwd(), API_ROOT);
    if (!existsSync(apiRootPath) || !statSync(apiRootPath).isDirectory()) {
      return;
    }

    const usages = collectApiUsages();
    const offenders = [];

    for (const file of walkFiles(apiRootPath, /\.ts$/)) {
      const name = relative(process.cwd(), file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");

      if (!MUTATION_HANDLER.test(source)) {
        continue;
      }
      if (source.includes(EXTERNAL_CALLER_MARKER)) {
        continue;
      }

      const routeMatch = source.match(/createFileRoute\(\s*["'`]([^"'`]+)["'`]/);
      if (!routeMatch) {
        offenders.push(`${name}: mutation handler without a createFileRoute path`);
        continue;
      }

      const routePath = routeMatch[1];
      if (SCAFFOLD_PATHS.some((pattern) => pattern.test(routePath))) {
        continue;
      }

      const route = routeSegments(routePath);
      const reachable = usages.some((usage) => segmentsMatch(route, usage.segments));

      if (!reachable) {
        offenders.push(`${name}: ${routePath}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Mutation endpoints with no UI caller are silently downgraded capabilities. ` +
        `Expose each one through a page action that calls apiUrl('<path>'), or — only for ` +
        `machine-to-machine endpoints (webhooks, platform callbacks) — add an ` +
        `EXTERNAL_CALLER comment naming the caller:\n${offenders.join("\n")}`,
    );
  });
});
