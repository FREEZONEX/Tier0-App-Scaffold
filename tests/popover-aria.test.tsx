import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Popover } from "../src/components/kit/ui/popover";

/**
 * Disabled popovers must not claim dialog semantics on the trigger in markup.
 * (Runtime also skips writing aria-expanded/haspopup — covered in Popover effect.)
 */
test("disabled Popover leaves the child trigger's expand state in markup", () => {
  const html = renderToStaticMarkup(
    <Popover disabled content={<p>flyout</p>} aria-label="子菜单">
      <button type="button" aria-expanded={true} aria-haspopup="menu">
        质量管理
      </button>
    </Popover>,
  );
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.ok(!html.includes("flyout"));
});
