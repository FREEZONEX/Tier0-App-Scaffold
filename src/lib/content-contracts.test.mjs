import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const UI_ROOTS = ["src/components", "src/routes"];
const EXCLUDED_UI_FILES = new Set([
  "src/components/Shell.tsx",
  "src/routes/login.tsx",
]);

const ROLE_CONTENT_COPY = [
  /当前角色|当前权限|权限模式|角色说明|角色能力|权限说明/,
  /current role|current permission|permission mode|role capabilities|role abilities|permission overview/i,
  /\b(?:Admin|Operator|Member|Planner|Quality|Warehouse)\b[^.\n<>{}]{0,48}\b(?:can|may|is allowed to)\b/i,
  /管理员可以|操作员可以|计划员可以|质检员可以|仓库可以/,
];

const PAGE_EXPLANATION_COPY = [
  /(?:本页|此页|当前页|当前页面|首页)[^\n<>{}]{0,40}(?:只?用于|用来|负责|展示|提供)/,
  /\b(?:this|the) page (?:is only for|is used (?:for|to)|lets you|allows you to|shows|provides)\b/i,
];

function toPosixPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function walkFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function findRoleContentCopy(source) {
  const stripped = stripComments(source);
  return ROLE_CONTENT_COPY.flatMap((pattern) => {
    const match = stripped.match(pattern);
    return match ? [match[0]] : [];
  });
}

function findPageExplanationCopy(source) {
  const stripped = stripComments(source);
  return PAGE_EXPLANATION_COPY.flatMap((pattern) => {
    const match = stripped.match(pattern);
    return match ? [match[0]] : [];
  });
}

describe("content contracts", () => {
  it("recognizes persistent role and permission explanation copy", () => {
    assert.deepEqual(findRoleContentCopy("<p>当前角色：admin</p>"), [
      "当前角色",
    ]);
    assert.deepEqual(findRoleContentCopy("<p>Permission mode: RBAC</p>"), [
      "Permission mode",
    ]);
    assert.deepEqual(findRoleContentCopy("<p>Admin can approve all orders</p>"), [
      "Admin can",
    ]);
    assert.deepEqual(findRoleContentCopy("<p>订单已释放</p>"), []);
  });

  it("keeps business content free of role explanation panels", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const rel = toPosixPath(relative(process.cwd(), file));
        if (EXCLUDED_UI_FILES.has(rel) || rel.startsWith("src/routes/api/")) {
          continue;
        }

        const matches = findRoleContentCopy(readFileSync(file, "utf8"));
        if (matches.length === 0) {
          continue;
        }

        offenders.push(`${rel}: ${matches.join(", ")}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Role display belongs in Shell only; business pages must show permissions through menus, data scope, and concrete action states:\n${offenders.join("\n")}`,
    );
  });

  it("recognizes persistent page-introduction explanations", () => {
    assert.deepEqual(
      findPageExplanationCopy(
        "<PageHeader description=\"首页只用于选择批次与进入下一任务\" />",
      ),
      ["首页只用于"],
    );
    assert.deepEqual(
      findPageExplanationCopy("<p>This page lets you review production tasks.</p>"),
      ["This page lets you"],
    );
    assert.deepEqual(findPageExplanationCopy("<p>待处理任务 12 条</p>"), []);
  });

  it("keeps business pages free of persistent page-introduction explanations", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) continue;

      for (const file of walkFiles(root)) {
        const rel = toPosixPath(relative(process.cwd(), file));
        if (EXCLUDED_UI_FILES.has(rel) || rel.startsWith("src/routes/api/")) {
          continue;
        }

        const matches = findPageExplanationCopy(readFileSync(file, "utf8"));
        if (matches.length > 0) offenders.push(`${rel}: ${matches.join(", ")}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Page headers should name the work, not explain the UI or route boundary:\n${offenders.join("\n")}`,
    );
  });

  it("documents the no role-summary-page-content rule for generators", () => {
    const agents = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");

    assert.match(agents, /Role display belongs to the global `Shell` user block only/);
    assert.match(agents, /Do not add page-body copy explaining what Admin/);
    assert.match(agents, /Do not add a page-introduction subtitle/);
    assert.match(agents, /defaultModules` starts empty/);
  });
});
