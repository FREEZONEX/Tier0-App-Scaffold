import assert from "node:assert/strict";
import test from "node:test";
import { Wrench, Rocket } from "lucide-react";
import {
  findNavIconName,
  NAV_ICON_LIBRARY,
  resolveNavIconComponent,
  suggestNavIcon,
} from "../src/components/nav-icons";

test("an imported lucide component is used as is, even outside the library", () => {
  assert.equal(resolveNavIconComponent(Rocket, "发射"), Rocket);
  assert.equal(resolveNavIconComponent(Wrench, "任意"), Wrench);
});

test("library names resolve in PascalCase, kebab-case and legacy aliases", () => {
  assert.equal(findNavIconName("Wrench"), "Wrench");
  assert.equal(findNavIconName("clipboard-list"), "ClipboardList");
  assert.equal(findNavIconName(" list_todo "), "ListTodo");
  assert.equal(findNavIconName("BarChart3"), "ChartColumn");
  assert.equal(findNavIconName("home"), "House");
  assert.equal(findNavIconName(""), null);
  assert.equal(findNavIconName("not-an-icon"), null);
});

test("menus without a usable icon get one from their business label", () => {
  assert.equal(resolveNavIconComponent(undefined, "报修单"), NAV_ICON_LIBRARY.Wrench);
  assert.equal(resolveNavIconComponent("no-such-icon", "库存台账"), NAV_ICON_LIBRARY.Warehouse);
  assert.equal(suggestNavIcon("设备报修"), "Wrench");
  assert.equal(suggestNavIcon("巡检任务"), "ClipboardCheck");
  assert.equal(suggestNavIcon("生产工单"), "ClipboardList");
  assert.equal(suggestNavIcon("系统设置"), "Settings");
  assert.equal(suggestNavIcon("Work Orders"), "ClipboardList");
  assert.equal(suggestNavIcon("Timeline"), null, "English keywords match whole-word starts only");
});

test("labels without a known keyword return null so Shell draws the letter mark", () => {
  assert.equal(resolveNavIconComponent(undefined, "执行员"), null);
  assert.equal(resolveNavIconComponent(null, ""), null);
  assert.equal(resolveNavIconComponent({ not: "an icon" }, "其他"), null);
});

test("every keyword rule points at a library icon", () => {
  for (const name of Object.keys(NAV_ICON_LIBRARY)) {
    assert.equal(typeof NAV_ICON_LIBRARY[name as keyof typeof NAV_ICON_LIBRARY], "object", name);
  }
});
