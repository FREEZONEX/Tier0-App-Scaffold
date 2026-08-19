import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeRepoRouteNesting,
  analyzeRouteNesting,
  inspectRouteModule,
  parseRouteTree,
} from "../../scripts/route-nesting.mjs";

/**
 * 构造一份最小 routeTree.gen.ts。字段形状与 TanStack 生成物一致，
 * 只保留检查用得到的 id / getParentRoute。
 */
function routeTree(entries) {
  const imports = [
    `import { Route as rootRouteImport } from './routes/__root'`,
    ...entries.map((e) => `import { Route as ${e.ident}Import } from '${e.module}'`),
  ].join("\n");

  const consts = entries
    .map(
      (e) => `const ${e.ident} = ${e.ident}Import.update({
  id: '${e.id}',
  getParentRoute: () => ${e.parent},
} as any)`,
    )
    .join("\n");

  return `${imports}\n\n${consts}\n`;
}

/** 父路由：自带内容但忘了出口——README 现有示例正是这个形状。 */
const PARENT_WITHOUT_OUTLET = `
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_app/work-orders")({
  component: WorkOrdersPage,
});
function WorkOrdersPage() {
  return <div className="p-6">Orders</div>;
}
`;

/** 父路由：纯布局，不声明 component（TanStack 自动使用 Outlet）。 */
const PARENT_LAYOUT_ONLY = `
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_app/work-orders")({});
`;

/** 父路由：显式渲染出口。 */
const PARENT_WITH_OUTLET = `
import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/_app/work-orders")({
  component: WorkOrdersLayout,
});
function WorkOrdersLayout() {
  return <Outlet />;
}
`;

const LEAF = `
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/x")({ component: () => <div /> });
`;

function analyze(entries, modules) {
  // 根路由在真实脚手架里始终渲染 Outlet，fixture 沿用该前提，
  // 以免每个用例都要重复声明一遍它。
  const withRoot = { "./routes/__root": PARENT_WITH_OUTLET, ...modules };
  return analyzeRouteNesting({
    routes: parseRouteTree(routeTree(entries)),
    readModule: (module) => withRoot[module] ?? LEAF,
  });
}

describe("route nesting contracts", () => {
  it("keeps the scaffold's own route tree free of nesting violations", () => {
    assert.deepEqual(analyzeRepoRouteNesting(), []);
  });

  it("accepts a complete list + detail structure", () => {
    const violations = analyze(
      [
        { ident: "WorkOrders", module: "./routes/_app.work-orders", id: "/work-orders", parent: "rootRouteImport" },
        { ident: "WorkOrdersIndex", module: "./routes/_app.work-orders.index", id: "/", parent: "WorkOrders" },
        { ident: "WorkOrdersDetail", module: "./routes/_app.work-orders.$id", id: "/$id", parent: "WorkOrders" },
      ],
      { "./routes/_app.work-orders": PARENT_WITH_OUTLET },
    );

    assert.deepEqual(violations, []);
  });

  it("fails when a nested detail route has no outlet in its parent", () => {
    const violations = analyze(
      [
        { ident: "WorkOrders", module: "./routes/_app.work-orders", id: "/work-orders", parent: "rootRouteImport" },
        { ident: "WorkOrdersDetail", module: "./routes/_app.work-orders.$id", id: "/$id", parent: "WorkOrders" },
      ],
      { "./routes/_app.work-orders": PARENT_WITHOUT_OUTLET },
    );

    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, "missing-outlet");
    // 必须能定位到具体资源
    assert.equal(violations[0].module, "./routes/_app.work-orders");
    assert.match(violations[0].message, /\$id/);
  });

  it("fails when a layout-only parent has a detail route but no default list route", () => {
    const violations = analyze(
      [
        { ident: "WorkOrders", module: "./routes/_app.work-orders", id: "/work-orders", parent: "rootRouteImport" },
        { ident: "WorkOrdersDetail", module: "./routes/_app.work-orders.$id", id: "/$id", parent: "WorkOrders" },
      ],
      { "./routes/_app.work-orders": PARENT_LAYOUT_ONLY },
    );

    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, "missing-index");
    assert.match(violations[0].message, /index route/);
  });

  it("checks detail routes regardless of the dynamic param name", () => {
    const violations = analyze(
      [
        { ident: "Orders", module: "./routes/_app.orders", id: "/orders", parent: "rootRouteImport" },
        { ident: "OrdersDetail", module: "./routes/_app.orders.$orderId", id: "/$orderId", parent: "Orders" },
      ],
      { "./routes/_app.orders": PARENT_WITHOUT_OUTLET },
    );

    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /\$orderId/);
  });

  it("does not flag a detail route that opts out of nesting with a trailing underscore", () => {
    // `_app.work-orders_.$id` 的父路由是 _app，不是 work-orders——
    // 于是 work-orders 没有子路由，无需出口，列表页可以照常渲染内容。
    const violations = analyze(
      [
        { ident: "App", module: "./routes/_app", id: "/_app", parent: "rootRouteImport" },
        { ident: "WorkOrders", module: "./routes/_app.work-orders", id: "/work-orders", parent: "App" },
        { ident: "WorkOrdersDetail", module: "./routes/_app.work-orders_.$id", id: "/work-orders/$id", parent: "App" },
      ],
      {
        "./routes/_app": PARENT_WITH_OUTLET,
        "./routes/_app.work-orders": PARENT_WITHOUT_OUTLET,
      },
    );

    assert.deepEqual(violations, []);
  });

  it("accepts a master-detail parent that renders both its own content and an outlet", () => {
    const masterDetail = `
      import { createFileRoute, Outlet } from "@tanstack/react-router";
      export const Route = createFileRoute("/_app/work-orders")({ component: Page });
      function Page() {
        return <div><OrderList /><Outlet /></div>;
      }
    `;
    const violations = analyze(
      [
        { ident: "WorkOrders", module: "./routes/_app.work-orders", id: "/work-orders", parent: "rootRouteImport" },
        { ident: "WorkOrdersDetail", module: "./routes/_app.work-orders.$id", id: "/$id", parent: "WorkOrders" },
      ],
      { "./routes/_app.work-orders": masterDetail },
    );

    assert.deepEqual(violations, []);
  });

  it("distinguishes an explicit outlet from a component-less layout", () => {
    assert.deepEqual(inspectRouteModule(PARENT_WITH_OUTLET), {
      hasOutlet: true,
      hasComponent: true,
    });
    assert.deepEqual(inspectRouteModule(PARENT_LAYOUT_ONLY), {
      hasOutlet: false,
      hasComponent: false,
    });
    assert.deepEqual(inspectRouteModule(PARENT_WITHOUT_OUTLET), {
      hasOutlet: false,
      hasComponent: true,
    });
  });
});
