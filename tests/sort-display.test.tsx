import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { describeSort, SortConditionList, SortPopover } from "../src/components/kit/meta/sort-popover";

const fields = [{ code: "code", name: "报修单号" }, { code: "priority", name: "优先级" }];
test("saved sort rules render their own field labels and directions", () => {
  const html = renderToStaticMarkup(
    <SortConditionList fields={fields} value={[
      { field: "code", direction: "desc" },
      { field: "priority", direction: "asc" },
    ]} onChange={() => {}} />,
  );
  assert.ok(html.includes("报修单号"));
  assert.ok(html.includes("优先级"));
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 2);
  assert.ok(!html.includes("请选择字段"));
});

test("cleared sorting renders no stale rules", () => {
  const html = renderToStaticMarkup(
    <SortConditionList fields={fields} value={[]} onChange={() => {}} />,
  );
  assert.ok(!html.includes('aria-label="排序字段"'));
  assert.ok(html.includes("添加排序条件"));
});

test("toolbar trigger names the first rule, its direction and how many more", () => {
  const html = renderToStaticMarkup(
    <SortPopover fields={fields} value={[
      { field: "code", direction: "desc" },
      { field: "priority", direction: "asc" },
    ]} onChange={() => {}} />,
  );
  assert.ok(html.includes("：报修单号 降序"));
  assert.ok(html.includes("+1"));
  assert.ok(html.includes('aria-label="排序：报修单号 降序，优先级 升序"'));
});

test("trigger without rules shows only 排序 and never a stale count", () => {
  const html = renderToStaticMarkup(<SortPopover fields={fields} value={[]} onChange={() => {}} />);
  assert.ok(html.includes("排序"));
  assert.ok(!html.includes("："));
  assert.ok(!/>\+?\d+</.test(html));
});

test("a rule on a field that is no longer offered stays readable", () => {
  assert.equal(describeSort({ field: "createdAt", direction: "desc" }, fields), "createdAt 降序");
  const html = renderToStaticMarkup(
    <SortConditionList fields={fields} value={[{ field: "createdAt", direction: "asc" }]} onChange={() => {}} />,
  );
  assert.ok(html.includes("createdAt"));
  assert.ok(!html.includes("请选择字段"));
});
