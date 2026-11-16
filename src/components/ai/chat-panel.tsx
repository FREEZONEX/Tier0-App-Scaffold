"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Send, Square } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { TextArea } from "@/components/kit/ui/input";
import { Button } from "@/components/ui/button";
import { apiUrl, cn } from "@/lib/utils";

/**
 * ChatPanel — streamed AI chat against the App's own `/api/ai/chat` route.
 *
 * Not mounted anywhere by default: place it on a page when the user asks for
 * an AI feature. The browser only talks to the App's route; the route
 * authenticates the visitor and calls the workspace LLM on the server
 * (`src/services/ai/chat.ts`). `useChat` sends one POST per turn and does not
 * resume a reply after a reload; the conversation lives in the page only.
 */
export interface ChatPanelLabels {
  placeholder: string;
  send: string;
  stop: string;
  empty: string;
  you: string;
  assistant: string;
  usedTool: string;
  failed: string;
}

export interface ChatPanelProps {
  labels?: Partial<ChatPanelLabels>;
  className?: string;
}

const DEFAULT_LABELS: ChatPanelLabels = {
  placeholder: "Ask a question",
  send: "Send",
  stop: "Stop",
  empty: "Ask the assistant about this application.",
  you: "You",
  assistant: "Assistant",
  usedTool: "Used",
  failed: "The assistant could not answer. Try again.",
};

function toolName(part: UIMessage["parts"][number]): string | null {
  if (part.type === "dynamic-tool") return part.toolName;
  return part.type.startsWith("tool-") ? part.type.slice("tool-".length) : null;
}

export function ChatPanel({ labels, className }: ChatPanelProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [input, setInput] = useState("");
  const [transport] = useState(() => new DefaultChatTransport({ api: apiUrl("/api/ai/chat") }));
  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
    onError: (failure) => console.error("[ai/chat] request failed:", failure),
  });
  const busy = status === "submitted" || status === "streaming";

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    void sendMessage({ text: prompt });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      submit();
      event.preventDefault();
    }
  }

  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-sm text-text-tertiary">{text.empty}</p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "min-w-0 rounded-[4px] px-3 py-2 text-sm",
                message.role === "user" ? "self-end bg-muted" : "self-start",
              )}
            >
              <div className="mb-1 text-xs font-medium text-text-tertiary">
                {message.role === "user" ? text.you : text.assistant}
              </div>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <p key={index} className="whitespace-pre-wrap break-words">
                      {part.text}
                    </p>
                  );
                }
                const name = toolName(part);
                return name ? (
                  <p key={index} className="text-xs text-text-tertiary">
                    {text.usedTool} {name}
                  </p>
                ) : null;
              })}
            </article>
          ))
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {text.failed}
          </p>
        ) : null}
      </div>
      <form className="flex items-end gap-2" onSubmit={submit}>
        <TextArea
          aria-label={text.placeholder}
          placeholder={text.placeholder}
          value={input}
          onChange={setInput}
          onKeyDown={onKeyDown}
          autoSize={{ minRows: 1, maxRows: 6 }}
          resize="none"
          wrapperClassName="flex-1"
        />
        {busy ? (
          <Button type="button" variant="outline" icon={<Square />} onClick={() => void stop()}>
            {text.stop}
          </Button>
        ) : (
          <Button type="submit" icon={<Send />} disabled={!input.trim()}>
            {text.send}
          </Button>
        )}
      </form>
    </section>
  );
}
