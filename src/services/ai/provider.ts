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
 * authenticates the visitor first. Name models by alias (`default`); the
 * gateway maps the alias to a real model. Never pass a string model id to the
 * AI SDK: a bare string resolves through the SDK's global provider, not this one.
 *
 * Nothing happens at import time: the provider is created on first use.
 */

import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { HttpError } from "@/lib/route-handlers";

const BASE_URL_ENV = "TIER0_LLM_BASE_URL";
const API_KEY_ENV = "TIER0_LLM_API_KEY";

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
 * The workspace chat model for `alias` (default `default`), for `streamText`,
 * `generateText` or a `ToolLoopAgent`. Throws a 503 `HttpError` when the
 * platform has not provided the LLM variables (e.g. local development without
 * them exported).
 */
export function tier0Model(alias = "default"): LanguageModel {
  return tier0Provider().chatModel(alias);
}
