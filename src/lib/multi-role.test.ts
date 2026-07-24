import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  getGatewayRole,
  getGatewayRoles,
  getTrustedGatewayRoles,
} from "./gateway";
import {
  can,
  getEffectiveActions,
  hasAnyRole,
  PERMISSION_MATRIX,
  type Action,
} from "./permissions";
import { filterVisibleModules, type NavModule } from "../components/shell-modules";

describe("Tier0 multi-role gateway context", () => {
  it("keeps the active role first and includes every deployed business role", () => {
    const headers = new Headers({
      "X-Tier0-Runtime": "deployed",
      "X-Tier0-Active-Role": "warehouse_manager",
      "X-Tier0-Business-Roles":
        "receiver,warehouse_manager,quality_inspector,receiver",
    });

    assert.equal(getGatewayRole(headers), "warehouse_manager");
    assert.deepEqual(getGatewayRoles(headers), [
      "warehouse_manager",
      "receiver",
      "quality_inspector",
    ]);
    assert.deepEqual(getTrustedGatewayRoles(headers), [
      "warehouse_manager",
      "receiver",
      "quality_inspector",
    ]);
  });

  it("keeps preview as a single selected view-as role", () => {
    const headers = new Headers({
      "X-Tier0-Runtime": "preview",
      "X-Tier0-Preview-Role": "receiver",
      "X-Tier0-Active-Role": "warehouse_manager",
      "X-Tier0-Business-Roles": "receiver,warehouse_manager",
    });

    assert.deepEqual(getGatewayRoles(headers), ["receiver"]);
  });

  it("treats an explicit deployed empty role list as authoritative zero access", () => {
    const headers = new Headers({
      "X-Tier0-Runtime": "deployed",
      "X-App-User-Role": "admin",
    });

    assert.deepEqual(getTrustedGatewayRoles(headers), []);
    assert.deepEqual(getGatewayRoles(headers), []);
    assert.equal(getGatewayRole(headers), undefined);
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
