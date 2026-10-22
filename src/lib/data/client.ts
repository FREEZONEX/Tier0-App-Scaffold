/**
 * Data client factory: collection handles, cross-collection transactions and
 * the shared bootstrap. `src/lib/data/index.ts` builds the App's instance from
 * `src/data/collections.ts`; tests build their own with a mock `fetch`.
 */
import type { z } from "zod";
import { createBootstrap, type DataEnvironment, type EnsureState, type Logger } from "./bootstrap";
import { assertAtomicBatch, Collection, toDoc, type UnsRecord, type WithMeta } from "./collection";
import { currentDataSubject } from "./context";
import { MAX_COLLECTIONS, type CollectionDefinition } from "./define";
import { toSortPairs, type Filter, type Sort } from "./query";
import { validateStepData, validateUpdate } from "./schema";
import { createTransport, DataError, type TransportConfig } from "./transport";

export const TRANSACT_PATH = "/uns/records:transact";

export type TransactAction =
  | "record.create"
  | "record.check"
  | "record.read"
  | "record.update"
  | "record.modify"
  | "record.replace"
  | "record.delete"
  | "record.query";

/** One `records:transact` item; `collection` is a declaration or alias instead of a collection ID. */
export interface TransactStep {
  opId: string;
  action: TransactAction;
  collection: CollectionDefinition | string;
  id?: string | { ref: string };
  filter?: Filter;
  data?: Record<string, unknown>;
  update?: Record<string, unknown>;
  upsert?: boolean;
  expectedRevision?: number;
  dependsOn?: string[];
  bindings?: { path: string; ref: string; resultPath: string }[];
  selection?: "exactOne" | "first";
  sort?: Sort;
  returnDocument?: "before" | "after";
  exists?: boolean;
  operations?: Record<string, unknown>[];
  conditions?: Filter[];
  /** `record.query`: rows to bind from; `expectCount` asserts the match count before `limit`. */
  query?: { filter?: Filter; sort?: Sort; limit?: number; expectCount?: { min?: number; max?: number } };
  arrayFilters?: Record<string, unknown>[];
}

export interface TransactResultItem {
  opId: string;
  action: string;
  id: string;
  status: string;
  collectionId?: string;
  revision?: number;
  /** Before/after snapshot when requested, as a flat document. */
  document?: WithMeta<Record<string, unknown>>;
  data?: unknown;
  query?: unknown;
  error?: unknown;
}

export interface TransactResult {
  status: string;
  results: TransactResultItem[];
}

export interface DataClientConfig extends TransportConfig {
  collections: readonly CollectionDefinition[];
  /** Defaults to "deployed" when NODE_ENV is production, otherwise "preview". */
  environment?: DataEnvironment;
  logger?: Logger;
}

export interface DataClient {
  /** Typed handle for a declaration listed in `collections`. */
  collection<C extends CollectionDefinition>(definition: C): Collection<z.output<C["schema"]>, z.input<C["schema"]>>;
  /** Handle by alias, typed by the caller. */
  collection<T extends object = Record<string, unknown>>(alias: string): Collection<T>;
  /**
   * Atomic multi-record, multi-collection write (`records:transact`, sync),
   * at most 200 steps. Steps can depend on each other (`dependsOn`) and bind
   * earlier results (`bindings`). This is not a Mongo session: everything is
   * sent at once.
   */
  transact(steps: readonly TransactStep[], options?: { dryRun?: boolean; idempotencyKey?: string }): Promise<TransactResult>;
  /** Ensures every declaration now (normally lazy on first access). */
  ensure(): Promise<EnsureState>;
}

export function createDataClient(config: DataClientConfig): DataClient {
  const call = createTransport(config);
  const environment = config.environment ?? (process.env.NODE_ENV === "production" ? "deployed" : "preview");
  const declared = [...config.collections];
  if (declared.length > MAX_COLLECTIONS) {
    throw new Error(`An App declares at most ${MAX_COLLECTIONS} collections; src/data/collections.ts lists ${declared.length}.`);
  }
  const seen = new Set<string>();
  for (const definition of declared) {
    const key = definition.alias.toLowerCase();
    if (seen.has(key)) throw new Error(`Collection alias "${definition.alias}" is declared twice (aliases are case-insensitive).`);
    seen.add(key);
  }

  const bootstrap = createBootstrap({ call, collections: declared, environment, logger: config.logger ?? console });
  const runtime = {
    call,
    resolve: (target: CollectionDefinition | string) => bootstrap.resolve(lookup(target)),
    recover: bootstrap.recover,
    subject: currentDataSubject,
  };
  const handles = new Map<CollectionDefinition, Collection<object>>();

  function lookup(target: CollectionDefinition | string): CollectionDefinition {
    if (typeof target === "string") {
      const found = declared.find((definition) => definition.alias.toLowerCase() === target.toLowerCase());
      if (!found) throw new Error(`Collection "${target}" is not declared in src/data/collections.ts.`);
      return found;
    }
    if (!declared.includes(target)) {
      throw new Error(`Collection "${target.alias}" is declared but missing from the \`collections\` list in src/data/collections.ts.`);
    }
    return target;
  }

  function collection(target: CollectionDefinition | string) {
    const definition = lookup(target);
    let handle = handles.get(definition);
    if (!handle) {
      handle = new Collection<object>(definition, runtime);
      handles.set(definition, handle);
    }
    return handle;
  }

  async function transact(
    steps: readonly TransactStep[],
    options: { dryRun?: boolean; idempotencyKey?: string } = {},
  ): Promise<TransactResult> {
    assertAtomicBatch("data.transact", steps.length);
    // Steps resolve their collection IDs inside the recovered call, so a retry uses fresh IDs.
    const result = await bootstrap.recover(() => sendTransaction(steps, options));
    const results = (result.results ?? []).map(({ document, ...item }) => ({
      ...item,
      ...(document ? { document: toDoc<Record<string, unknown>>(document) } : {}),
    }));
    const expected = options.dryRun ? "validated" : "committed";
    if (result.status !== expected) {
      const failed = results.filter((item) => item.error);
      throw new DataError({
        message: `Transaction ${result.status}: ${failed.map((item) => `${item.opId} ${JSON.stringify(item.error)}`).join("; ") || "no step committed"}`,
        status: 409,
        code: "TRANSACTION_FAILED",
        details: { status: result.status, results },
      });
    }
    return { status: result.status, results };
  }

  async function sendTransaction(steps: readonly TransactStep[], options: { dryRun?: boolean; idempotencyKey?: string }) {
    const items = await Promise.all(
      steps.map(async ({ collection: target, sort, query, ...step }) => {
        const definition = lookup(target);
        const item: Record<string, unknown> = { ...step, collectionId: await bootstrap.resolve(definition) };
        if (sort) item.sort = toSortPairs(sort);
        if (query) item.query = { ...query, ...(query.sort ? { sort: toSortPairs(query.sort) } : {}) };
        if (step.data) {
          // Fields bound to earlier results are filled by UNS at commit; everything literal validates now.
          const bound = (step.bindings ?? []).flatMap((binding) => (binding.path.startsWith("data.") ? [binding.path.slice(5).split(".")[0]] : []));
          item.data = validateStepData(definition, step.data, bound);
        }
        if (step.update) item.update = validateUpdate(definition, step.update);
        return item;
      }),
    );
    return call<{ status: string; results?: (Omit<TransactResultItem, "document"> & { document?: UnsRecord })[] }>(
      TRANSACT_PATH,
      {
        items,
        mode: "sync",
        ...(options.dryRun ? { dryRun: true } : {}),
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
      },
      { dataSubject: currentDataSubject() },
    );
  }

  return { collection: collection as DataClient["collection"], transact, ensure: bootstrap.ensure };
}
