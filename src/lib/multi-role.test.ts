import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Visitor } from "./visitor";
import { visitorRoles } from "./visitor";
import {
  can,
  getEffectiveActions,
  hasAnyRole,
  PERMISSION_MATRIX,
  type Action,
} from "./permissions";
import { filterVisibleModules, type NavModule } from "../components/shell-modules";

const visitor = (appRoles: string[], activeRole?: string) => ({ appRoles, activeRole }) as unknown as Visitor;

describe("visitor roles", () => {
  it("keeps the active role first and includes every role", () => {
    assert.deepEqual(visitorRoles(visitor(["receiver", "warehouse_manager"], "warehouse_manager")), ["warehouse_manager", "receiver"]);
  });

  it("gives an active role outside the set no authority", () => {
    assert.deepEqual(visitorRoles(visitor(["receiver"], "warehouse_manager")), ["receiver"]);
  });

  it("treats an empty role set as zero roles", () => {
    assert.deepEqual(visitorRoles(visitor([])), []);
  });
});

describe("multi-role permission union", () => {
  it("keeps the singular primary role out of the authorization surface", () => {
    const appUserSource = readFileSync(
      new URL("./users.ts", import.meta.url),
      "utf8",
    );

    assert.match(appUserSource, /\bprimaryRole:\s*string/);
    assert.match(appUserSource, /\broles:\s*string\[\]/);
    assert.doesNotMatch(appUserSource, /^\s*role:\s*string/m);
  });

  it("grants an action when any assigned role grants it", () => {
    const action = "manage_system" satisfies Action;
    PERMISSION_MATRIX.receiver = [];
    PERMISSION_MATRIX.warehouse_manager = [action];

    try {
      assert.equal(can(["receiver", "warehouse_manager"], action), true);
      assert.deepEqual(
        getEffectiveActions(["receiver", "warehouse_manager"]),
        [action],
      );
      assert.equal(can(["receiver", "unknown_role"], action), false);
    } finally {
      delete PERMISSION_MATRIX.receiver;
      delete PERMISSION_MATRIX.warehouse_manager;
    }
  });

  it("accepts any assigned role for role-restricted server routes", () => {
    assert.equal(
      hasAnyRole(
        ["receiver", "quality_inspector"],
        ["warehouse_manager", "quality_inspector"],
      ),
      true,
    );
    assert.equal(
      hasAnyRole(["receiver"], ["warehouse_manager", "quality_inspector"]),
      false,
    );
  });

  it("shows navigation when the effective role union grants its actions", () => {
    PERMISSION_MATRIX.receiver = [];
    PERMISSION_MATRIX.warehouse_manager = ["manage_system"];
    const modules: NavModule[] = [
      {
        key: "settings",
        label: "Settings",
        href: "/settings",
        actions: ["manage_system"],
      },
    ];

    try {
      assert.deepEqual(
        filterVisibleModules(modules, ["receiver", "warehouse_manager"]),
        modules,
      );
      assert.deepEqual(filterVisibleModules(modules, ["receiver"]), []);
    } finally {
      delete PERMISSION_MATRIX.receiver;
      delete PERMISSION_MATRIX.warehouse_manager;
    }
  });
});
