import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceIdFromApiKey, tier0MqCredentials } from "./tier0-credentials";

describe("tier0-credentials", () => {
  it("3 段 key 解析 workspaceID（base36）", () => {
    assert.equal(workspaceIdFromApiKey("sk-agent-ws1z_secret"), "71"); // parseInt("1z",36)=71
  });

  it("secret 含 '-'（>3 段）仍能解析（修 SDK 的 3 段限制）", () => {
    assert.equal(workspaceIdFromApiKey("sk-agent-ws1z_-i3-YV6"), "71");
  });

  it("非法 key → undefined", () => {
    assert.equal(workspaceIdFromApiKey(undefined), undefined);
    assert.equal(workspaceIdFromApiKey("sk-foo"), undefined);          // 段数不足
    assert.equal(workspaceIdFromApiKey("nope-x-ws1z_y"), undefined);   // 非 sk 前缀
    assert.equal(workspaceIdFromApiKey("sk-x-zz1z_y"), undefined);     // 第三段非 ws
    assert.equal(workspaceIdFromApiKey("sk-x-ws_y"), undefined);       // ws 后无 id
  });

  it("tier0MqCredentials → username '<id>&open' + clientId '<id>&<rand>'", () => {
    assert.deepEqual(tier0MqCredentials("sk-agent-ws1z_secret", "rnd123"), {
      username: "71&open",
      clientId: "71&rnd123",
    });
    assert.equal(tier0MqCredentials("bad", "rnd"), undefined);
  });
});
