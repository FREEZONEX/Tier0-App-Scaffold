import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closeIncompleteMarkup,
  shouldSubmitComposerKey,
  sliceRevealedText,
} from "../src/lib/text-reveal";

test("composer sends on Enter, not Shift+Enter or IME", () => {
  assert.equal(shouldSubmitComposerKey({ key: "Enter", shiftKey: false }), true);
  assert.equal(shouldSubmitComposerKey({ key: "Enter", shiftKey: true }), false);
  assert.equal(
    shouldSubmitComposerKey({ key: "Enter", shiftKey: false, isComposing: true }),
    false,
  );
  assert.equal(
    shouldSubmitComposerKey({ key: "Enter", shiftKey: false, keyCode: 229 }),
    false,
  );
  assert.equal(shouldSubmitComposerKey({ key: "a", shiftKey: false }), false);
});

test("reveal slice closes unfinished markdown markers", () => {
  assert.equal(closeIncompleteMarkup("**ALM"), "**ALM**");
  assert.equal(closeIncompleteMarkup("use `"), "use ");
  assert.equal(closeIncompleteMarkup("use `N"), "use `N`");
  assert.equal(closeIncompleteMarkup("use `N·m`"), "use `N·m`");
  assert.equal(sliceRevealedText("abcdefghij", 4), "abcd");
  assert.equal(sliceRevealedText("abcdefghij", 40), "abcdefghij");
  assert.equal(sliceRevealedText("**bold**", 0), "");
});
