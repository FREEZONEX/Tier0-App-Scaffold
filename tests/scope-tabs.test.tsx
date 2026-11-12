import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CapsuleGroup } from "../src/components/kit/ui/tabs";

test("scope filters expose selected state and retain zero counts", () => {
  const html = renderToStaticMarkup(<CapsuleGroup value="cancelled" items={[
    { key: "mine", label: "我负责的", count: 0 },
    { key: "cancelled", label: "已取消", count: 1 },
  ]} />);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 1);
  assert.match(html, />0<\/span>/);
  assert.match(html, />1<\/span>/);
  assert.match(html, /max-w-full/);
});
