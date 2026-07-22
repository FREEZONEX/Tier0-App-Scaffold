import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGatewayRole, parseGatewayUser } from "./gateway";

describe("gateway header parsing", () => {
  it("keeps ASCII legacy role headers unchanged", () => {
    const headers = new Headers({
      "X-App-User-Role": "boss",
    });

    assert.equal(getGatewayRole(headers), "boss");
  });

  it("decodes percent-encoded preview roles in preview runtime", () => {
    const headers = new Headers({
      "X-Tier0-Runtime": "preview",
      "X-Tier0-Preview-Role": "%E8%80%81%E6%9D%BF",
      "X-Tier0-Active-Role": "boss",
      "X-App-User-Role": "admin",
    });

    assert.equal(getGatewayRole(headers), "老板");
  });

  it("decodes latin-1 mojibake active roles", () => {
    const mojibakeRole = Buffer.from("老板", "utf8").toString("latin1");
    const headers = new Headers({
      "X-Tier0-Active-Role": mojibakeRole,
      "X-App-User-Role": "boss",
    });

    assert.equal(getGatewayRole(headers), "老板");
  });

  it("decodes a mojibake JSON user header back to the original unicode role", () => {
    const mojibakeUserHeader = Buffer.from(
      JSON.stringify({
        userID: "u-1",
        userName: "alice",
        role: "老板",
      }),
      "utf8",
    ).toString("latin1");
    const headers = new Headers({
      user: mojibakeUserHeader,
    });

    assert.deepEqual(parseGatewayUser(headers), {
      id: "u-1",
      name: "alice",
      email: "",
      role: "老板",
    });
  });

  it("prefers active role headers over JSON user.role", () => {
    const headers = new Headers({
      "X-Tier0-Active-Role": "boss",
      user: JSON.stringify({
        userID: "u-2",
        userName: "mercy",
        role: "operator",
      }),
    });

    assert.deepEqual(parseGatewayUser(headers), {
      id: "u-2",
      name: "mercy",
      email: "",
      role: "boss",
    });
  });
});
