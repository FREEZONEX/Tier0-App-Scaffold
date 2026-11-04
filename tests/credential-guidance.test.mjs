import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// 凭据不进 VM：Preview 与部署里没有 TIER0_API_KEY，平台调用经节点代理 sbx-api-proxy。
// 给沙箱 agent 和开发者看的指引不许再说平台会注入 Key，也不许推荐代理不转发的接口。
const GUIDANCE = [
  "AGENTS.md",
  "README.md",
  ".env.example",
  ...readdirSync("docs").filter((name) => name.endsWith(".md")).map((name) => join("docs", name)),
];

function read(path) {
  return readFileSync(path, "utf8");
}

test("guidance never says the platform injects TIER0_API_KEY into Preview or deployments", () => {
  const injected = [
    /TIER0_API_KEY\s*=\s*"?<platform-injected>/,
    /App key \(TIER0_API_KEY\)/,
    /reads TIER0_API_HOST \/ TIER0_API_KEY/,
    /platform injects[^.]*TIER0_API_KEY/i,
    /TIER0_API_KEY[^.\n]*injected into (Preview|the sandbox|deployments)/i,
  ];
  for (const path of GUIDANCE) {
    const text = read(path);
    for (const pattern of injected) assert.doesNotMatch(text, pattern, `${path} reintroduces an injected App key`);
  }
  const agents = read("AGENTS.md");
  assert.match(agents, /there is no `TIER0_API_KEY` and no credential file/);
  assert.match(agents, /X-Tier0-SDK: 1/);
});

test("guidance does not build App features on endpoints the node proxy does not forward", () => {
  // members.listApp 走 /openapi/v2/apps/access-members/list，节点代理白名单不含它（待调度方拍板）。
  for (const path of GUIDANCE) {
    assert.doesNotMatch(read(path), /tier0\.members\.listApp\(\{/, `${path} recommends members.listApp`);
  }
  assert.match(read("AGENTS.md"), /Not available to the App in Preview and deployments[\s\S]*tier0\.members\.listApp/);
});
