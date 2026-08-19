/**
 * Route nesting contract analyzer.
 *
 * TanStack file routes nest by the `.` separator, so `_app.work-orders.$id.tsx`
 * is a CHILD of `_app.work-orders.tsx`. A parent renders its children through
 * `<Outlet />`. When a parent draws its own content and forgets the outlet, the
 * child route still matches but never renders — TypeScript, ESLint and the build
 * all pass, and the blank detail page is only discovered by clicking it.
 *
 * This module turns that silent failure into a build failure.
 *
 * The parent/child graph is read from `src/routeTree.gen.ts`, which the TanStack
 * plugin regenerates during `vite build`. Using the generated tree (rather than
 * guessing from filenames) means the rules work for flat routes, directory
 * routes and any dynamic param name, and it makes routes that opt out of nesting
 * with a trailing `_` simply not appear as children at all.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT_IDENT = "rootRouteImport";

/** Index routes are emitted with id `/`; dynamic routes carry a `$param` segment. */
const isIndexRoute = (route) => route.id === "/";
const isDynamicRoute = (route) => route.id.includes("$");

/**
 * Parse `routeTree.gen.ts` into route records keyed by their generated identifier.
 *
 * The generated file has a stable shape:
 *   import { Route as AppRouteImport } from './routes/_app'
 *   const AppIndexRoute = AppIndexRouteImport.update({
 *     id: '/', path: '/', getParentRoute: () => AppRoute,
 *   } as any)
 */
export function parseRouteTree(source) {
  const sf = ts.createSourceFile(
    "routeTree.gen.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  // 1) `import { Route as X } from './routes/foo'` → X 对应的源文件
  const importIdentToModule = new Map();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      if (el.propertyName?.text !== "Route") continue;
      importIdentToModule.set(el.name.text, stmt.moduleSpecifier.text);
    }
  }

  // 2) `const Y = X.update({ ... })` → 一条路由记录
  const routes = new Map();
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const record = parseUpdateCall(decl.initializer);
      if (!record) continue;
      routes.set(decl.name.text, {
        ident: decl.name.text,
        module: importIdentToModule.get(record.importIdent) ?? null,
        ...record,
      });
    }
  }

  // 3) 根路由没有 const 包装，直接以 import 标识符参与父子关系
  if (importIdentToModule.has(ROOT_IDENT)) {
    routes.set(ROOT_IDENT, {
      ident: ROOT_IDENT,
      importIdent: ROOT_IDENT,
      module: importIdentToModule.get(ROOT_IDENT),
      id: "__root__",
      parentIdent: null,
    });
  }

  return routes;
}

/** 从 `X.update({ id, path, getParentRoute } as any)` 抽出路由字段。 */
function parseUpdateCall(expr) {
  let node = expr;
  if (ts.isAsExpression(node)) node = node.expression;
  if (!ts.isCallExpression(node)) return null;
  if (
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== "update" ||
    !ts.isIdentifier(node.expression.expression)
  ) {
    return null;
  }

  const importIdent = node.expression.expression.text;
  let arg = node.arguments[0];
  if (arg && ts.isAsExpression(arg)) arg = arg.expression;
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;

  let id = null;
  let parentIdent = null;
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
    if (prop.name.text === "id" && ts.isStringLiteralLike(prop.initializer)) {
      id = prop.initializer.text;
    }
    if (prop.name.text === "getParentRoute") {
      const fn = prop.initializer;
      if (ts.isArrowFunction(fn) && ts.isIdentifier(fn.body)) {
        parentIdent = fn.body.text;
      }
    }
  }

  return id === null ? null : { importIdent, id, parentIdent };
}

/**
 * 检查单个路由文件是否提供子路由出口。
 *
 * 两种合法形态：显式渲染 `<Outlet />`，或整个路由不声明 `component`
 * （TanStack 在无 component 时自动使用 Outlet）。
 */
export function inspectRouteModule(source) {
  const sf = ts.createSourceFile(
    "route.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let hasOutlet = false;
  let hasComponent = false;

  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(sf) === "Outlet") hasOutlet = true;
    }
    // createFileRoute("/x")({ component: Page }) / createRootRoute()({ ... })
    if (
      ts.isCallExpression(node) &&
      ts.isCallExpression(node.expression) &&
      isRouteFactory(node.expression.expression)
    ) {
      let arg = node.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          const name = prop.name && ts.isIdentifier(prop.name) ? prop.name.text : null;
          if (name === "component") hasComponent = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { hasOutlet, hasComponent };
}

function isRouteFactory(expr) {
  const name = ts.isIdentifier(expr)
    ? expr.text
    : ts.isPropertyAccessExpression(expr)
      ? expr.name.text
      : null;
  if (!name) return false;
  return name.startsWith("createFileRoute") || name.startsWith("createRootRoute");
}

/**
 * 对整棵路由树执行嵌套契约检查。
 *
 * 规则 A：任何拥有子路由的父路由必须提供出口，否则子路由永远渲染不出来。
 * 规则 B：父路由未声明 component（纯布局）且拥有子路由时，必须存在 index 子路由，
 *         否则父路径本身只渲染一个空出口，列表页无处安放。
 *         父路由自带 component（内容 + Outlet 的主从布局）不受此规则约束。
 */
export function analyzeRouteNesting({ routes, readModule }) {
  const childrenOf = new Map();
  for (const route of routes.values()) {
    if (!route.parentIdent) continue;
    if (!childrenOf.has(route.parentIdent)) childrenOf.set(route.parentIdent, []);
    childrenOf.get(route.parentIdent).push(route);
  }

  const violations = [];

  for (const [parentIdent, children] of childrenOf) {
    const parent = routes.get(parentIdent);
    if (!parent?.module) continue;

    const source = readModule(parent.module);
    if (source === null) continue; // 解析不到源文件时不臆断
    const { hasOutlet, hasComponent } = inspectRouteModule(source);

    const dynamicChildren = children.filter(isDynamicRoute);

    if (hasComponent && !hasOutlet) {
      violations.push({
        rule: "missing-outlet",
        module: parent.module,
        routeId: parent.id,
        children: children.map((c) => c.id),
        message:
          `${parent.module} declares a component but never renders <Outlet />, ` +
          `so its ${children.length} child route(s) (${children.map((c) => c.id).join(", ")}) ` +
          `can never render. Render <Outlet /> in the parent and move its own content ` +
          `into an index route, or opt out of nesting with a trailing "_" on the parent segment.`,
      });
      continue;
    }

    if (!hasComponent && dynamicChildren.length > 0) {
      const hasIndex = children.some(isIndexRoute);
      if (!hasIndex) {
        violations.push({
          rule: "missing-index",
          module: parent.module,
          routeId: parent.id,
          children: children.map((c) => c.id),
          message:
            `${parent.module} is a layout-only parent (no component) with a dynamic child ` +
            `(${dynamicChildren.map((c) => c.id).join(", ")}) but no index route, so its own ` +
            `path renders an empty outlet. Add the sibling index route that owns the default ` +
            `list experience.`,
        });
      }
    }
  }

  return violations;
}

/** 以仓库磁盘布局装配一次完整检查。 */
export function analyzeRepoRouteNesting(cwd = process.cwd()) {
  const treePath = join(cwd, "src/routeTree.gen.ts");
  const routes = parseRouteTree(readFileSync(treePath, "utf8"));

  const readModule = (module) => {
    // routeTree 里的 './routes/foo' 相对 src/ 解析，扩展名需自行补齐
    const base = join(cwd, "src", module.replace(/^\.\//, ""));
    for (const ext of [".tsx", ".ts"]) {
      try {
        return readFileSync(`${base}${ext}`, "utf8");
      } catch {
        continue;
      }
    }
    return null;
  };

  return analyzeRouteNesting({ routes, readModule });
}
