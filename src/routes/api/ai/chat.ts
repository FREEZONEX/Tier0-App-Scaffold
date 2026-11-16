/**
 * AI chat endpoint for `useChat` (`src/components/ai/chat-panel.tsx`).
 *
 * POST only: the browser sends the chat history and gets the assistant's
 * reply as a UI message stream. The visitor is authenticated first; the tools
 * the model may use are chosen per user in `src/services/ai/chat.ts`. The LLM
 * is called from the server only (`@/services/ai/provider`); the browser never
 * reaches the gateway. A closed connection aborts the reply.
 */

import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { streamChatReply } from "@/services/ai/chat";

const chatInput = z.object({
  messages: z.array(z.unknown()).min(1).max(200),
});

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: withErrors(async ({ request }) => {
        const user = await requireAuth();
        const { messages } = chatInput.parse(await request.json());
        const stream = await streamChatReply(user, messages, request.signal);
        return createUIMessageStreamResponse({ stream, keepAliveMs: 15_000 });
      }),
    },
  },
});
