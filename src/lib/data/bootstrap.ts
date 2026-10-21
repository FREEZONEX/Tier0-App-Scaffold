/**
 * First-access bootstrap: one batched `ensure` of every declared collection.
 *
 * - ensure only creates or widens; storage never narrows from here, so old
 *   and new code may cold-start in any order (see AGENTS.md → App Data).
 * - The result is memoized per client, i.e. per server process; a Vite dev
 *   reload of src/data/collections.ts builds a new client and ensures again.
 *   Failures are not memoized: a later call retries (an imported App may
 *   answer "hosted App is not ready").
 * - Seed documents are inserted only for collections ensure reports as
 *   `created`: fixed `_id`s, atomic chunks of 200 with a stable idempotency
 *   key per chunk so a retried chunk replays instead of duplicating. Seed
 *   writes never carry a data subject.
 * - Preview throws on SCHEMA_CONFLICT and warnings so the worker sees them;
 *   a deployment logs them and keeps serving with the IDs it has.
 * - Self-healing: a Preview reset hard-deletes collections, and a worker or
 *   admin may archive one, while this process still holds the old IDs. A
 *   record call that fails with `data.reason` COLLECTION_NOT_FOUND or
 *   COLLECTION_NOT_GRANTED drops the memo, ensures again (seeding what is created)
 *   and retries the call once, but only when a collection ID actually
 *   changed. Rebuilds are limited to one per REBUILD_INTERVAL_MS per client;
 *   APP_GRANT_REVOKED is never retried (ensure itself reports it).
 * - `ignored` notes never fail a request. ensure never writes annotations, so
 *   an edited `.describe()` or collection description comes back as
 *   ANNOTATION_NOT_APPLIED; it is logged as a warning pointing at
 *   schema:replace, which is the only way to change stored annotations.
 */
import { createHash } from "node:crypto";
import { MAX_ATOMIC_ITEMS } from "./collection";
import type { CollectionDefinition } from "./define";
import { compileCollection, validateDocument, type CompiledCollection } from "./schema";
import { ACCESS_REASONS, DataError, type Transport } from "./transport";

export const ENSURE_PATH = "/uns/app/collections/ensure";

export type DataEnvironment = "preview" | "deployed";

export interface EnsureWarning {
  code: string;
  path?: string;
  message?: string;
}

export interface EnsureNote {
  path: string;
  reason?: string;
  message?: string;
}

export interface EnsureResult {
  alias: string;
  collectionId: string;
  revision: number;
  status: "created" | "unchanged" | "widened";
  ignored?: EnsureNote[];
  warnings?: EnsureWarning[];
  indexStatus?: unknown[];
}

export interface EnsureConflict {
  alias: string;
  collectionId?: string;
  path?: string;
  reason?: string;
  current?: string;
  declared?: string;
}

export interface EnsureState {
  appId?: string;
  results: EnsureResult[];
  /** Lower-cased alias → collection ID. */
  collectionIds: Map<string, string>;
  /** Declarations that conflicted in a deployment (served with their existing ID, if any). */
  conflicts: EnsureConflict[];
}

export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface BootstrapConfig {
  call: Transport;
  collections: readonly CollectionDefinition[];
  environment: DataEnvironment;
  logger: Logger;
}

const SEED_ATTEMPTS = 3;

/** At most one self-healing rebuild per client in this window. */
export const REBUILD_INTERVAL_MS = 30_000;

/**
 * Whether a record call failed because the collection ID it used is gone or
 * no longer granted, by UNS's stable `data.reason` code. Archive and Preview
 * purge also remove the App grant, so most stale IDs answer
 * COLLECTION_NOT_GRANTED or COLLECTION_NOT_FOUND. APP_PERMISSION_MISSING (the
 * key lacks e.g. `uns.delete`) and APP_GRANT_REVOKED are not stale IDs.
 */
export function isStaleCollectionError(error: unknown): boolean {
  return (
    error instanceof DataError &&
    (error.reason === ACCESS_REASONS.notGranted || error.reason === ACCESS_REASONS.notFound)
  );
}

function sameCollectionIds(a: EnsureState, b: EnsureState): boolean {
  if (a.collectionIds.size !== b.collectionIds.size) return false;
  for (const [alias, id] of a.collectionIds) {
    if (b.collectionIds.get(alias) !== id) return false;
  }
  return true;
}

/** Idempotency key of one seed chunk (UNS keys are at most 96 characters). */
function seedChunkKey(collectionId: string, chunk: number): string {
  return `seed-${createHash("sha256").update(collectionId).digest("hex").slice(0, 40)}-${chunk}`;
}

/** What to do about each SCHEMA_CONFLICT reason (CloudAppCollectionConflict.reason). */
const CONFLICT_HINTS: Record<string, string> = {
  TYPE_CONFLICT: "a field's type cannot change; use a new field name and backfill with updateMany",
  LIMIT_EXCEEDED: "the joined schema exceeds a UNS limit (depth, properties, enum values or indexes); split the structure",
  OPEN_OBJECT: "every object must be closed; declare it with z.object",
  ALIAS_IN_USE: "the alias belongs to another collection; pick another alias",
  NAME_IN_USE: "the name belongs to another collection; pick another alias",
  INVALID_INDEX: "fix the index declaration",
  JOIN_UNSUPPORTED:
    "the stored schema holds a node the declaration cannot widen (e.g. enum values outside its range); repair it with schema:replace via the tier0 MCP",
  DATA_RULE_FIELD:
    "an employee data rule (ownerField / stateField) uses this field; keep it required with the same type, or ask a workspace admin to change the rule",
};

function describeConflicts(conflicts: EnsureConflict[]): string {
  return conflicts
    .map((conflict) => {
      const where = `${conflict.alias}${conflict.path ? `.${conflict.path}` : ""}`;
      const types = conflict.current || conflict.declared ? ` (stored ${conflict.current ?? "?"}, declared ${conflict.declared ?? "?"})` : "";
      const hint = conflict.reason && CONFLICT_HINTS[conflict.reason] ? ` — ${CONFLICT_HINTS[conflict.reason]}` : "";
      return `  - ${where}: ${conflict.reason ?? "conflict"}${types}${hint}`;
    })
    .join("\n");
}

function notePath(alias: string, note: EnsureNote): string {
  return note.path ? `${alias}.${note.path}` : alias;
}

function describeWarnings(results: EnsureResult[]): string {
  return results
    .flatMap((result) =>
      (result.warnings ?? []).map(
        (warning) => `  - ${result.alias}${warning.path ? `.${warning.path}` : ""}: ${warning.code}${warning.message ? ` — ${warning.message}` : ""}`,
      ),
    )
    .join("\n");
}

export function createBootstrap(config: BootstrapConfig) {
  const { call, collections, environment, logger } = config;
  let pending: Promise<EnsureState> | null = null;
  let lastRebuild = Number.NEGATIVE_INFINITY;

  async function requestEnsure(items: CompiledCollection[]) {
    // ensure is App-level work: it never carries the employee data subject.
    return call<{ appId?: string; results: EnsureResult[] }>(ENSURE_PATH, { collections: items });
  }

  async function insertSeedChunk(collectionId: string, chunk: number, documents: { id?: string; data: Record<string, unknown> }[]) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await call(`/uns/collections/${encodeURIComponent(collectionId)}/records:insertMany`, {
          collectionId,
          documents,
          ordered: true,
          atomic: true,
          idempotencyKey: seedChunkKey(collectionId, chunk),
        });
        return;
      } catch (error) {
        // Same key on retry: a chunk that did commit replays instead of failing on duplicate IDs.
        if (!(error instanceof DataError) || !error.retryable || attempt >= SEED_ATTEMPTS) throw error;
      }
    }
  }

  async function writeSeeds(results: EnsureResult[]) {
    for (const result of results) {
      if (result.status !== "created") continue;
      const definition = collections.find((candidate) => candidate.alias.toLowerCase() === result.alias.toLowerCase());
      const seed = definition?.seed;
      if (!definition || !seed || seed.length === 0) continue;
      try {
        const documents = seed.map((document) => {
          const { id, data } = validateDocument(definition, document as Record<string, unknown>);
          return { id, data };
        });
        for (let start = 0; start < documents.length; start += MAX_ATOMIC_ITEMS) {
          await insertSeedChunk(result.collectionId, start / MAX_ATOMIC_ITEMS, documents.slice(start, start + MAX_ATOMIC_ITEMS));
        }
        logger.info(`[data] seeded ${documents.length} record(s) into "${result.alias}"`);
      } catch (error) {
        // The collection exists now; a later ensure reports "unchanged" and
        // never re-seeds, so the failure must be visible in the server log.
        logger.error(`[data] seed for new collection "${result.alias}" failed; it keeps the chunks written so far:`, error);
      }
    }
  }

  async function run(payload: CompiledCollection[]): Promise<EnsureState> {
    const conflicts: EnsureConflict[] = [];
    let remaining = payload;
    let response: { appId?: string; results: EnsureResult[] } = { results: [] };
    while (remaining.length > 0) {
      try {
        response = await requestEnsure(remaining);
        break;
      } catch (error) {
        if (!(error instanceof DataError) || error.code !== "SCHEMA_CONFLICT") throw error;
        const reported = Array.isArray(error.details.conflicts) ? (error.details.conflicts as EnsureConflict[]) : [];
        const summary = describeConflicts(reported);
        if (environment === "preview") {
          throw new DataError({
            message:
              `src/data/collections.ts conflicts with the stored collection schema; nothing was changed:\n${summary}`,
            status: 409,
            code: "SCHEMA_CONFLICT",
            upstreamStatus: error.upstreamStatus,
            requestId: error.requestId,
            details: error.details,
          });
        }
        // A deployment keeps serving: drop the conflicting declarations (the
        // whole batch was rejected) and ensure the rest again.
        const conflicting = new Set(reported.map((conflict) => conflict.alias.toLowerCase()));
        const next = remaining.filter((item) => !conflicting.has(item.alias.toLowerCase()));
        if (next.length === remaining.length) throw error;
        logger.error(`[data] ensure: declarations conflict with stored schemas; serving them unchanged:\n${summary}`);
        conflicts.push(...reported);
        remaining = next;
      }
    }

    const results = response.results ?? [];
    const collectionIds = new Map<string, string>();
    for (const conflict of conflicts) {
      if (conflict.collectionId) collectionIds.set(conflict.alias.toLowerCase(), conflict.collectionId);
    }
    for (const result of results) {
      collectionIds.set(result.alias.toLowerCase(), result.collectionId);
      const notes = result.ignored ?? [];
      const annotations = notes.filter((note) => note.reason === "ANNOTATION_NOT_APPLIED");
      const wider = notes.filter((note) => note.reason !== "ANNOTATION_NOT_APPLIED");
      if (wider.length > 0) {
        logger.info(
          `[data] "${result.alias}" storage is wider than this declaration (or has retired parts); ignored: ` +
            wider.map((note) => `${note.path || "(root)"} ${note.reason ?? ""}`.trim()).join(", "),
        );
      }
      if (annotations.length > 0) {
        // A hint, not an error: storage keeps its annotations and serves as before.
        logger.warn(
          `[data] ensure does not change stored titles/descriptions; not applied: ${annotations.map((note) => notePath(result.alias, note)).join(", ")}. ` +
            `Apply them with schema:replace via the tier0 MCP (body from \`npm run data:schema -- ${result.alias}\`).`,
        );
      }
    }

    await writeSeeds(results);

    const warnings = describeWarnings(results);
    if (warnings) {
      if (environment === "preview") {
        throw new DataError({
          message:
            `Collections were ensured with warnings:\n${warnings}\n` +
            "REQUIRED_NOT_ENFORCED: make the field optional again or narrow explicitly with schema:replace via the tier0 MCP. " +
            "INDEX_BUILD_FAILED: fix the duplicate or invalid data, then the next ensure retries the index.",
          status: 500,
          code: "SCHEMA_WARNINGS",
          details: { results },
        });
      }
      logger.warn(`[data] ensure warnings:\n${warnings}`);
    }

    return { appId: response.appId, results, collectionIds, conflicts };
  }

  /** Ensures every declaration once per client; a failure is forgotten so the next call retries. */
  function ensure(): Promise<EnsureState> {
    pending ??= Promise.resolve()
      .then(() => run(collections.map(compileCollection)))
      .catch((error) => {
        pending = null;
        throw error;
      });
    return pending;
  }

  /**
   * Re-ensures after `before` turned out stale. Joins a rebuild already in
   * flight; otherwise rebuilds at most once per REBUILD_INTERVAL_MS. Resolves
   * whether any collection ID changed; ensure errors (APP_GRANT_REVOKED, …)
   * propagate.
   */
  async function rebuild(before: EnsureState, cause: DataError): Promise<boolean> {
    const current = ensure();
    const latest = await current;
    if (latest !== before) return !sameCollectionIds(before, latest);
    if (pending !== current) return !sameCollectionIds(before, await ensure());
    const now = Date.now();
    if (now - lastRebuild < REBUILD_INTERVAL_MS) return false;
    lastRebuild = now;
    logger.warn(`[data] a collection ID is no longer usable (${cause.code}: ${cause.message}); ensuring collections again`);
    pending = null;
    return !sameCollectionIds(before, await ensure());
  }

  /**
   * Runs one data call; when it fails on a stale collection ID, rebuilds and
   * runs it once more if an ID changed. `retry: false` (calls continuing a
   * cursor or resumeAfter token of the old collection) only rebuilds.
   */
  async function recover<R>(fn: () => Promise<R>, options: { retry?: boolean } = {}): Promise<R> {
    const before = await ensure();
    try {
      return await fn();
    } catch (error) {
      if (!isStaleCollectionError(error)) throw error;
      const changed = await rebuild(before, error as DataError);
      if (!changed || options.retry === false) throw error;
      return fn();
    }
  }

  async function resolve(definition: CollectionDefinition): Promise<string> {
    const state = await ensure();
    const id = state.collectionIds.get(definition.alias.toLowerCase());
    if (!id) {
      throw new DataError({
        message: `Collection "${definition.alias}" is unavailable: ensure did not return it (see the server log).`,
        status: 503,
        code: "COLLECTION_UNAVAILABLE",
      });
    }
    return id;
  }

  return { ensure, resolve, recover };
}
