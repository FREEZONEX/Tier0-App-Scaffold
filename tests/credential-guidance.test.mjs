import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Preview 与部署里平台把 App 的 Key 作为 TIER0_API_KEY 注入运行进程，SDK 直接用它。
// 给沙箱 agent 和开发者看的指引不许再说 VM 里没有 Key、由节点代理代填，或要求手写请求带 X-Tier0-SDK: 1；
// 也不许推荐 App 的 Key 用不了的接口。
// App 的平台能力固定（含 Stream 请求和消息），没有按 App 配置的平台策略、消息主题或发布确认；
// 关联外部集合或扩大访问前与用户确认；MQTT 主题只能在 App 自己的命名空间里，示例一律用 appTopic 拼。
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
  assert.match(unsupported, /tier0\.mqttAuth/);
  assert.doesNotMatch(unsupported, /members\.listApp/, "listApp is available to the App");
  assert.doesNotMatch(unsupported, /client\.streams/, "Stream requests and messages are fixed App capabilities");
  assert.doesNotMatch(unsupported, /tier0\.capabilities/, "capabilities/discover is on the App key's allowlist");
  assert.match(agents, /tier0\.members\.listApp\(\{ appId: resolveAppId\(\) \}\)/);
  const integration = read("docs/platform-integration.md");
  const availability = integration.match(/\*\*Availability in Preview and deployments\.\*\*[\s\S]*?\n\n/)?.[0] ?? "";
  const [usable, unusable = ""] = availability.split("are not supported for Apps")[0].split("`system.whoami()`");
  assert.match(usable, /members\.listApp\(\)/);
  assert.match(usable, /client\.streams\.requests/);
  assert.match(usable, /client\.streams\.messages/);
  assert.match(usable, /capabilities\.discover\(\)/);
  assert.doesNotMatch(unusable, /client\.streams|capabilities/);
  assert.match(availability, /`system\.whoami\(\)`[^;]*are not supported for Apps/);
  assert.doesNotMatch(unusable, /listApp/);
  for (const path of GUIDANCE) {
    assert.doesNotMatch(read(path), /listApp[^.\n]*(currently unavailable|not supported)/, `${path} says listApp is unavailable`);
  }
});

test("guidance describes fixed App capabilities and confirmed external collection access", () => {
  const retired = [
    /appStreamPolicy/,
    /platform permissions and message\s+topics are managed/i,
    /managed by workspace\s+admins/i,
    /message\s+topics that workspace admins set/i,
    /confirmed when\s+publishing/i,
    /App policy and published Stream manifest/,
    /Workspace\/App policy/,
    /(Not yet supported|Currently unavailable) in Preview and deployments/,
    /lacks it\)/,
    /needs the App's `platform\.users\.read`/,
  ];
  for (const path of GUIDANCE) {
    const text = read(path);
    for (const pattern of retired) assert.doesNotMatch(text, pattern, `${path} reintroduces the per-App platform policy (${pattern})`);
  }
  const agents = read("AGENTS.md");
  assert.match(agents, /fixed platform capabilities/);
  assert.match(agents, /Before linking an external collection or expanding its access, confirm\s+the target collection, purpose and required access \(read, write, delete\) with\s+the user/);
  assert.match(agents, /verify the resulting grant before reporting success/);
  const integration = read("docs/platform-integration.md");
  for (const capability of [
    "openapi.base",
    "platform.users.read",
    "notifications.send",
    "asset.file.upload",
    "stream.requests.read",
    "stream.messages.publish",
  ]) {
    assert.ok(integration.includes(`\`${capability}\``), `platform-integration.md lists the fixed capability ${capability}`);
  }
  assert.match(integration, /no per-App topic list/);
  assert.match(read("README.md"), /confirms the collection and required access with the user before linking it\s+or expanding access/);
});

test("MQTT examples stay in the App's namespace through appTopic", () => {
  for (const path of GUIDANCE) {
    const text = read(path);
    const calls = [...text.matchAll(/\b(?:mq|appMq)\.(?:subscribe|publish)\(([^,\n]*)/g)];
    for (const [call, topic] of calls) {
      assert.match(topic, /^appTopic\(/, `${path}: ${call} must build its topic with appTopic`);
    }
  }
  const integration = read("docs/platform-integration.md");
  assert.match(integration, /`apps\/<TIER0_APP_ID>\/<preview\|deployed>\/…`/);
  assert.match(integration, /const \{ Tier0MQClient, appTopic \} = await loadTier0Mq\(\);/);
  assert.match(integration, /mq\.subscribe\(appTopic\("alarms\/#"\)/);
  assert.match(read("AGENTS.md"), /`appTopic\(suffix\)`/);
});
