/**
 * Request context for the App data layer.
 *
 * The Tier0 App Gateway signs the current employee into
 * `X-Tier0-App-Data-Subject` on each business request. UNS uses it to narrow
 * App-key access to that employee (data rules, record leases). The data layer
 * forwards it only while serving that request: `src/start.ts` opens the
 * context, and ensure, seed writes and `runAsApp(...)` background work never
 * carry it.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export const DATA_SUBJECT_HEADER = "X-Tier0-App-Data-Subject";

interface RequestContext {
  dataSubject?: string;
}

// One store per process, shared across Vite SSR module reloads.
const STORAGE_KEY = Symbol.for("tier0.scaffold.data.request-context");
const globalStore = globalThis as typeof globalThis & {
  [STORAGE_KEY]?: AsyncLocalStorage<RequestContext | null>;
};
const storage = (globalStore[STORAGE_KEY] ??= new AsyncLocalStorage<RequestContext | null>());

/** Runs `fn` as part of the business request whose headers are given. */
export function runWithRequestContext<T>(headers: Headers, fn: () => T): T {
  const dataSubject = headers.get(DATA_SUBJECT_HEADER)?.trim() || undefined;
  return storage.run(dataSubject ? { dataSubject } : {}, fn);
}

/**
 * Runs `fn` as the App itself, outside any employee's request: use it for
 * work that outlives or is detached from the request (timers, queues, fire-
 * and-forget follow-ups). Its data calls carry no data subject.
 */
export function runAsApp<T>(fn: () => T): T {
  return storage.run(null, fn);
}

/** The data subject of the request being served, if any. */
export function currentDataSubject(): string | undefined {
  return storage.getStore()?.dataSubject;
}
