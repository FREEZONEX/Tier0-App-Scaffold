import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Preview 与部署里平台把 App 的 Key 作为 TIER0_API_KEY 注入运行进程，SDK 直接用它。
// 给沙箱 agent 和开发者看的指引不许再说 VM 里没有 Key、由节点代理代填，或要求手写请求带 X-Tier0-SDK: 1；
// 也不许推荐 App 的 Key 用不了的接口。
const GUIDANCE = [
  "AGENTS.md",
  "README.md",
  ".env.example",
  ...readdirSync("docs").filter((name) => name.endsWith(".md")).map((name) => join("docs", name)),
];

function read(path) {
  return readFileSync(path, "utf8");
}

test("guidance says the App's key is TIER0_API_KEY in the App's process", () => {
  const retired = [
    /no `TIER0_API_KEY`/,
    /there is no `TIER0_API_KEY`/,
    /no credential file/,
    /needs no credential/,
    /cannot read any/,
    /node proxy[^.\n]*(injects|attaches|adds)/i,
    /never in the VM/,
    /X-Tier0-SDK/,
    /sbx_proxy_/,
    /api\.sbx\.internal/,
  ];
  for (const path of GUIDANCE) {
    const text = read(path);
    for (const pattern of retired) assert.doesNotMatch(text, pattern, `${path} reintroduces the node-proxy credential model (${pattern})`);
  }
  const agents = read("AGENTS.md");
  assert.match(agents, /the App's key is in the App's process\s+environment\*\* as `TIER0_API_KEY`/);
  assert.match(agents, /Never read, copy, log or return it from App code/);
  assert.match(read("README.md"), /\| `TIER0_API_KEY` \| The App's key \(secret, runtime process only, never at build\) \|/);
  assert.match(read("docs/platform-integration.md"), /\| `TIER0_API_KEY` \| [^\n]*The App's key: a secret in the runtime process only/);
});

test("guidance builds App features only on endpoints the App's key may call", () => {
  const agents = read("AGENTS.md");
  const unsupported = agents.match(/Not supported for the App in Preview and deployments[\s\S]*?\n\n/)?.[0] ?? "";
  assert.match(unsupported, /tier0\.system\.whoami/);
  assert.doesNotMatch(unsupported, /members\.listApp/, "listApp is available to the App");
  assert.match(agents, /tier0\.members\.listApp\(\{ appId: resolveAppId\(\) \}\)/);
  const integration = read("docs/platform-integration.md");
  const availability = integration.match(/\*\*Availability in Preview and deployments\.\*\*[\s\S]*?\n\n/)?.[0] ?? "";
  const [usable, unusable = ""] = availability.split("are not supported for Apps")[0].split("`system.whoami()`");
  assert.match(usable, /members\.listApp\(\)/);
  assert.match(availability, /`system\.whoami\(\)`[^;]*are not supported for Apps/);
  assert.doesNotMatch(unusable, /listApp/);
  for (const path of GUIDANCE) {
    assert.doesNotMatch(read(path), /listApp[^.\n]*(currently unavailable|not supported)/, `${path} says listApp is unavailable`);
  }
});
