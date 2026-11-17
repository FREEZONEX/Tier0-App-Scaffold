/**
 * The workspace LLM for the App's server (Vercel AI SDK, OpenAI-compatible).
 *
 * In Preview and deployments the platform injects `TIER0_LLM_BASE_URL` (the
 * workspace token gateway) and `TIER0_LLM_API_KEY` (a placeholder, not a
 * secret). The platform's egress adds the workspace key on the way out, so App
 * code never holds an LLM key: do not read, log or return either variable, and
 * do not configure another key here.
 *
 * Server only: browser pages call the App's own route (`/api/ai/chat`), which
 * authenticates the visitor first. Name models by alias (`default` or `fast`);
 * the gateway maps the alias to a real model. Never pass a string model id to
 * the AI SDK: a bare string resolves through the SDK's global provider, not
 * this one.
 *
 * Nothing happens at import time: the provider is created on first use.
 */

import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { HttpError } from "@/lib/route-handlers";

const BASE_URL_ENV = "TIER0_LLM_BASE_URL";
const API_KEY_ENV = "TIER0_LLM_API_KEY";

/** The model aliases the workspace gateway maps; no other name reaches it. */
export const TIER0_MODEL_ALIASES = ["default", "fast"] as const;

/**
 * A workspace model alias:
 * - `default`: the general model, for chat and agent loops with tools.
 * - `fast`: cheaper and quicker, for high-volume simple calls (classify,
 *   extract, summarize, rewrite, batch jobs, short answers).
 * When unsure, use `default`.
 */
export type Tier0ModelAlias = (typeof TIER0_MODEL_ALIASES)[number];

let cached: { baseURL: string; apiKey: string; provider: OpenAICompatibleProvider } | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new HttpError(
      503,
      `AI is not configured: ${name} is not set. The platform provides it in Preview and deployments.`,
    );
  }
  return value;
}

function tier0Provider(): OpenAICompatibleProvider {
  const baseURL = requiredEnv(BASE_URL_ENV);
  const apiKey = requiredEnv(API_KEY_ENV);
  if (!cached || cached.baseURL !== baseURL || cached.apiKey !== apiKey) {
    cached = {
      baseURL,
      apiKey,
      provider: createOpenAICompatible({ name: "tier0", baseURL, apiKey, includeUsage: true }),
    };
  }
  return cached.provider;
}

/**
 * The workspace chat model for `alias`, for `streamText`, `generateText` or a
 * `ToolLoopAgent`: `default` (the default) for chat and tool loops, `fast` for
 * high-volume simple calls. Throws an `Error` for any other alias (a bug in
 * the calling code, answered 500) and a 503 `HttpError` when the platform has
 * not provided the LLM variables (e.g. local development without them
 * exported).
 */
export function tier0Model(alias: Tier0ModelAlias = "default"): LanguageModel {
  if (!(TIER0_MODEL_ALIASES as readonly string[]).includes(alias)) {
    throw new Error(`Unknown model alias "${String(alias)}": use "default" or "fast".`);
  }
  return tier0Provider().chatModel(alias);
}
