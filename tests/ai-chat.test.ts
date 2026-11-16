// The shipped AI example (src/services/ai/**): the provider refuses without the
// platform variables and names models by alias; the example agent validates the
// history and streams the gateway's reply. Not part of the App build (postbuild):
// an App that rewrites the example updates or drops these cases.
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ChatPanel } from "../src/components/ai";
import { HttpError } from "../src/lib/route-handlers";
import type { AppUser } from "../src/lib/users";
import { chatTools, streamChatReply } from "../src/services/ai/chat";
import { tier0Model } from "../src/services/ai/provider";

const user: AppUser = { id: "u-1", username: "u-1", displayName: "u-1", primaryRole: "planner", roles: ["planner"] };
const history = [{ id: "m1", role: "user", parts: [{ type: "text", text: "What time is it?" }] }];
const realFetch = globalThis.fetch;
const env = { ...process.env };

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

function configure() {
  process.env.TIER0_LLM_BASE_URL = "https://gateway.test/v1";
  process.env.TIER0_LLM_API_KEY = "aenv-egress-injected";
}

/** A gateway that streams `pieces` as one OpenAI chat completion and records what it was sent. */
function fakeGateway(pieces: string[]) {
  const calls: { url: string; authorization: string | null; body: { model: string; stream: boolean } }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)),
    });
    const chunk = (delta: object, finish: string | null = null) =>
      `data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 0, model: "real-model", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    const sse = [...pieces.map((content) => chunk({ content })), chunk({}, "stop"), "data: [DONE]\n\n"].join("");
    return new Response(sse, { headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  return calls;
}

async function collect(stream: ReadableStream<{ type: string }>) {
  const chunks: { type: string; delta?: string }[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<{ type: string; delta?: string }>) chunks.push(chunk);
  return chunks;
}

describe("workspace LLM provider", () => {
  it("refuses with a 503 naming the missing variable", () => {
    delete process.env.TIER0_LLM_BASE_URL;
    delete process.env.TIER0_LLM_API_KEY;
    assert.throws(() => tier0Model(), (error: unknown) =>
      error instanceof HttpError && error.status === 503 && /TIER0_LLM_BASE_URL/.test(error.message));
    process.env.TIER0_LLM_BASE_URL = "https://gateway.test/v1";
    assert.throws(() => tier0Model(), (error: unknown) =>
      error instanceof HttpError && error.status === 503 && /TIER0_LLM_API_KEY/.test(error.message));
  });

  it("names the model by alias on the tier0 provider", () => {
    configure();
    const model = tier0Model() as { modelId: string; provider: string };
    assert.equal(model.modelId, "default");
    assert.equal(model.provider, "tier0.chat");
    assert.equal((tier0Model("fast") as { modelId: string }).modelId, "fast");
  });
});

describe("example chat agent", () => {
  it("gives tools that answer for the visitor only", async () => {
    const tools = chatTools(user);
    assert.deepEqual(Object.keys(tools).sort(), ["currentTime", "myAccess"]);
    const access = await tools.myAccess.execute!({}, { toolCallId: "t1", messages: [] } as never);
    assert.deepEqual(access, { userId: "u-1", roles: ["planner"] });
  });

  it("rejects a malformed history before calling the model", async () => {
    configure();
    const calls = fakeGateway(["unused"]);
    await assert.rejects(streamChatReply(user, [{ role: "bogus" }], new AbortController().signal), (error: unknown) =>
      error instanceof HttpError && error.status === 400);
    assert.equal(calls.length, 0);
  });

  it("streams the reply from the gateway with the alias and the placeholder key", async () => {
    configure();
    const calls = fakeGateway(["It is ", "noon."]);
    const chunks = await collect(await streamChatReply(user, history, new AbortController().signal));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://gateway.test/v1/chat/completions");
    assert.equal(calls[0].authorization, "Bearer aenv-egress-injected");
    assert.equal(calls[0].body.model, "default");
    assert.equal(calls[0].body.stream, true);
    const text = chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("");
    assert.equal(text, "It is noon.");
    assert.equal(chunks.at(-1)?.type, "finish");
  });
});

describe("ChatPanel", () => {
  it("server-renders the empty conversation with its labels", () => {
    const html = renderToString(createElement(ChatPanel, { labels: { empty: "No questions yet" } }));
    assert.match(html, /No questions yet/);
    assert.match(html, /<textarea[^>]*aria-label="Ask a question"/);
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled/);
  });
});
