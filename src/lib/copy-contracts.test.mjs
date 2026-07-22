import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const UI_ROOTS = ["src/components", "src/routes"];

// High-precision future-promise phrases only. Wizard navigation words such as
// "下一步" / "Next" are legitimate UI copy and must stay out of this list.
const FUTURE_PROMISE_COPY =
  /即将上线|敬请期待|暂未实现|暂不支持|后续版本|规划中|待实现|coming soon|not yet implemented|will be (?:available|implemented)|future (?:version|release)|planned for a later/i;

function walkFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findFuturePromiseCopy(source) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const match = stripped.match(FUTURE_PROMISE_COPY);
  return match ? match[0] : null;
}

describe("copy contracts", () => {
  it("flags future-promise copy and accepts wizard navigation copy", () => {
    assert.equal(findFuturePromiseCopy(`<p>该功能即将上线</p>`), "即将上线");
    assert.equal(
      findFuturePromiseCopy(`<span>Coming soon: batch import</span>`),
      "Coming soon",
    );
    assert.equal(findFuturePromiseCopy(`<button>下一步</button>`), null);
    assert.equal(findFuturePromiseCopy(`<Button>Next</Button>`), null);
    assert.equal(
      findFuturePromiseCopy(`// TODO: coming soon in a comment is ignored`),
      null,
    );
  });

  it("keeps generated UI free of future-promise capability copy", () => {
    const offenders = [];

    for (const root of UI_ROOTS) {
      if (!statSync(root).isDirectory()) {
        continue;
      }

      for (const file of walkFiles(root)) {
        const promise = findFuturePromiseCopy(readFileSync(file, "utf8"));
        if (promise) {
          offenders.push(`${relative(process.cwd(), file)}: "${promise}"`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `UI must not promise unimplemented capabilities - implement the minimum path or remove the surface:\n${offenders.join("\n")}`,
    );
  });
});
