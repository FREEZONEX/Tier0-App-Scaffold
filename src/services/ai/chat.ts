/**
 * Example AI chat agent: one streamed agent loop per request, with tools.
 *
 * Tools run on the App's server as the App: every data call they make is the
 * App's own and the platform does not narrow it by user. So build the tool set
 * per request from the visitor (`requireAuth()` in the route) and give a tool
 * only to users whose roles allow the action, exactly like a service would
 * (`can(user.roles, action)`); filter and trim what a tool returns the same
 * way. Never put the App's key or any other secret into instructions, messages
 * or tool output.
 *
 * AI SDK v7 API (`streamText`, `tool`, `isStepCount`, `toUIMessageStream`):
 * see `node_modules/ai/docs`, not older SDK examples.
 */

import {
  convertToModelMessages,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  tool,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";
import { HttpError } from "@/lib/route-handlers";
import type { AppUser } from "@/lib/users";
import { tier0Model } from "@/services/ai/provider";

/** Upper bound of model calls (tool round trips included) per request. */
const MAX_STEPS = 5;

const INSTRUCTIONS =
  "You are the assistant of this application. Answer briefly. Use the tools for the current time " +
  "and for the signed-in user's roles; say so when you cannot answer.";

/** The tools `user` may use in this request. */
export function chatTools(user: AppUser): ToolSet {
  const tools: ToolSet = {
    currentTime: tool({
      description: "The current date and time on the server, as an ISO 8601 UTC timestamp.",
      inputSchema: z.object({}),
      execute: async () => ({ now: new Date().toISOString() }),
    }),
    myAccess: tool({
      description: "The signed-in user's id and application roles.",
      inputSchema: z.object({}),
      execute: async () => ({ userId: user.id, roles: user.roles }),
    }),
  };
  // A tool that reads or changes App data is added only for the roles allowed
  // to do that, and receives `user` like any service, for example:
  //   if (can(user.roles, "view_orders")) tools.findOrders = tool({ ... execute: (input) => findOrders(input, user) });
  return tools;
}

/**
 * Validate the browser's chat history and stream the assistant's reply as a
 * UI message stream. `signal` is the request's: when the browser goes away the
 * model call and the tool loop stop.
 */
export async function streamChatReply(
  user: AppUser,
  messages: unknown,
  signal: AbortSignal,
): Promise<ReadableStream<UIMessageChunk>> {
  const tools = chatTools(user);
  const validated = await safeValidateUIMessages<UIMessage>({ messages, tools });
  if (!validated.success) {
    throw new HttpError(400, "Invalid chat messages");
  }
  const model = tier0Model();
  const result = streamText({
    model,
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(validated.data, { tools }),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    abortSignal: signal,
  });
  return toUIMessageStream({
    stream: result.stream,
    tools,
    originalMessages: validated.data,
    onError(error) {
      console.error("[ai/chat] reply failed:", error);
      return "The assistant could not answer. Try again.";
    },
  });
}
