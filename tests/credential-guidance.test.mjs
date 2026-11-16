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

test("guidance describes fixed App capabilities and incremental Builder collection grants", () => {
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
  assert.match(agents, /incremental `changes` with `expectedRevision`/);
  assert.match(agents, /preserve other grants and disabled status/);
  assert.match(agents, /Never use an App runtime key to manage\s+grants/);
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
  assert.match(read("README.md"), /verifying effective App access/);
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

// App 服务端经 @/services/ai/provider 直接调网关；真 key 由平台出站时加上，App 代码和 .env.example 里不能有 LLM key。
function sourceFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [path] : [];
  });
}

const LLM_PROVIDER = join("src", "services", "ai", "provider.ts");
const LIKELY_KEYS = [
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{24,}/,
];

test("App code and .env.example hold no LLM key", () => {
  const envExample = read(".env.example");
  assert.doesNotMatch(envExample, /TIER0_LLM_/, ".env.example must not list the platform-injected LLM variables");
  assert.doesNotMatch(envExample, /^\s*(?:export\s+)?[A-Z0-9_]*(?:LLM|OPENAI|ANTHROPIC|AI_GATEWAY|GEMINI|DEEPSEEK|AXONHUB)[A-Z0-9_]*\s*=/m, ".env.example must not configure an LLM key or gateway");
  for (const path of [".env.example", ...sourceFiles("src")]) {
    const text = read(path);
    for (const pattern of LIKELY_KEYS) assert.doesNotMatch(text, pattern, `${path} contains what looks like an API key (${pattern})`);
    assert.doesNotMatch(text, /\b(?:OPENAI|ANTHROPIC|AI_GATEWAY|GEMINI|GOOGLE_GENERATIVE_AI|DEEPSEEK|AXONHUB)_API_KEY\b/, `${path} reads a provider key; use tier0Model() from @/services/ai/provider`);
    assert.doesNotMatch(text, /\bTIER0_LLM_[A-Z_]+\s*(?:=(?!=)|:)/, `${path} assigns an LLM variable; only the platform sets them`);
    if (path === LLM_PROVIDER) continue;
    assert.doesNotMatch(text, /TIER0_LLM_/, `${path} reads the LLM variables; only @/services/ai/provider may`);
    if (/from\s+["'](?:ai|@ai-sdk\/[\w-]+)["']/.test(text)) {
      assert.doesNotMatch(text, /\bmodel\s*:\s*["'`]/, `${path} passes a string model id; use tier0Model()`);
    }
  }
  const provider = read(LLM_PROVIDER);
  assert.match(provider, /createOpenAICompatible\(\{ name: "tier0", baseURL, apiKey, includeUsage: true \}\)/);
  assert.match(provider, /export function tier0Model\(alias = "default"\)/);
  assert.doesNotMatch(provider, /console\.\w+\(/, "the provider never logs");
});

test("guidance routes LLM calls through the provider and keeps the key out of App code", () => {
  const agents = read("AGENTS.md");
  assert.match(agents, /calls the LLM only through `@\/services\/ai\/provider` and\s+never reads, writes or logs any LLM key/);
  assert.match(agents, /`TIER0_LLM_BASE_URL`[\s\S]*`TIER0_LLM_API_KEY` \(a\s+placeholder, not a secret/);
  assert.match(agents, /Never pass a string model id/);
  assert.match(agents, /include a tool only when `can\(user\.roles, action\)` allows it/);
  assert.match(agents, /`node_modules\/ai\/docs`/);
  const integration = read("docs/platform-integration.md");
  assert.match(integration, /### Calling the workspace LLM/);
  assert.match(integration, /\| `TIER0_LLM_API_KEY` \| [^\n]*A placeholder, not a secret/);
  assert.match(integration, /Only `TIER0_API_KEY` is a secret/);
  for (const path of GUIDANCE) {
    assert.doesNotMatch(read(path), /TIER0_LLM_API_KEY[^.\n]*\(secret/, `${path} calls the LLM placeholder a secret`);
  }
});
