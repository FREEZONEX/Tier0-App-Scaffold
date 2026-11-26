/**
 * Record change stream — server-only; backs `/api/uns/subscribe`.
 *
 * The SDK's `createChangeRelay` holds ONE upstream subscription per server
 * process (`data.subscribe` over every declared collection, as the App) and
 * fans it out to every browser event stream. Browsers never open their own
 * upstream: the Gateway limits open subscriptions per workspace, not per user.
 * This module adds what a browser asks for (`?collections=` and `?recordIds=`,
 * checked against the declared aliases) and what the App lets that user hear
 * about (`canSee`, from `src/lib/change-visibility.ts`).
 *
 * Positions and resume are the relay's: browsers never see upstream cursors.
 * Each event's SSE `id` is the relay's own `<epoch>.<seq>`, handed out only
 * once the upstream can deliver every change after it (on a cold start the
 * browsers get a `reset` first, so they reload after the upstream is live).
 * The relay reopens a failed or idle-closed upstream from its last UNS
 * position in the same epoch; only a UNS `reset` starts a new epoch and
 * resets the browsers. A reconnect's `Last-Event-ID` is replayed from the
 * latest changes of the current epoch, anything else answers that browser
 * with `reset`. While UNS cannot be reached the browsers get `unavailable`.
 * Every browser stream ends after 10 minutes, so the browser reconnects and
 * the route authenticates it again.
 *
 * Preview and deployments behave the same: the upstream acts as the App with
 * the App's key, so one shared upstream serves every browser stream.
 *
 * Events carry only collection, record ID, revision and kind of change, never
 * record data. The upstream runs as the App and sees every change of the
 * App's collections; the browser reloads through the App's API, where the
 * App's role rules apply.
 */
import { ALIAS_PATTERN, createChangeRelay, type ChangeRelay, type RecordChange } from "@tier0/sdk-v2/data";
import type { CollectionDefinition } from "@tier0/sdk-v2/data/define";
import { collections } from "../../data/collections";
import { HttpError } from "../route-handlers";
import { data } from "./index";

export interface ChangeFilter {
  /** Collection aliases; every declared collection (plus bound readable external collections) when empty. */
  collections: readonly string[];
  /** Only these records when non-empty. */
  recordIds: readonly string[];
}

export interface ChangeFilterOptions {
  /** Additional external collection aliases permitted in `?collections=`. */
  externalAliases?: readonly string[];
  /** Permit any syntactically valid external alias (`ALIAS_PATTERN`); upstream still subscribes only to granted collections. */
  allowExternalAliases?: boolean;
}

/** Whether a change is one the browser asked for. */
export function matchesFilter(filter: ChangeFilter, change: RecordChange): boolean {
  const target = change.collection.toLowerCase();
  return (
    (filter.collections.length === 0 || filter.collections.some((alias) => alias.toLowerCase() === target)) &&
    (filter.recordIds.length === 0 || filter.recordIds.includes(change.recordId))
  );
}

const MAX_RECORD_IDS = 100;

function listParam(url: URL, name: string): string[] {
  return [...new Set((url.searchParams.get(name) ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
}

/**
 * The filter a subscribe request asks for, checked against the `declared`
 * collection aliases and optional external aliases: `?collections=<alias,...>`
 * (all subscribed collections when absent) and `?recordIds=<id,...>` (≤100).
 * 404 when nothing is declared and no external aliases are permitted.
 */
export function changeFilter(
  request: Request,
  declared: readonly string[],
  externalOrOptions: readonly string[] | ChangeFilterOptions = [],
): ChangeFilter {
  const options: ChangeFilterOptions = Array.isArray(externalOrOptions)
    ? { externalAliases: externalOrOptions as readonly string[] }
    : (externalOrOptions as ChangeFilterOptions);
  const externalAliases = options.externalAliases ?? [];
  const allowExternalAliases = options.allowExternalAliases === true;
  const url = new URL(request.url);
  const filter: ChangeFilter = { collections: listParam(url, "collections"), recordIds: listParam(url, "recordIds") };
  const allowed = new Set([...declared, ...externalAliases].map((alias) => alias.toLowerCase()));
  const unknown = filter.collections.filter(
    (alias) => !allowed.has(alias.toLowerCase()) && !(allowExternalAliases && ALIAS_PATTERN.test(alias)),
  );
  if (unknown.length > 0) throw new HttpError(400, `Unknown collection alias: ${unknown.join(", ")}`);
  if (filter.recordIds.length > MAX_RECORD_IDS) throw new HttpError(400, `At most ${MAX_RECORD_IDS} recordIds per subscription`);
  if (allowed.size === 0 && !allowExternalAliases) throw new HttpError(404, "This App declares no collections");
  return filter;
}

let relay: ChangeRelay | undefined;

/**
 * `/api/uns/subscribe` for the request, filtered by `changeFilter` over the
 * App's declared collections and bound readable external collections, and by
 * `canSee`, and resumed from `Last-Event-ID`. Authenticate before calling it.
 */
export function streamChanges(
  request: Request,
  canSee: (change: RecordChange) => boolean,
  options?: { externalAliases?: readonly string[] },
): Response {
  const filter = changeFilter(
    request,
    (collections as readonly CollectionDefinition[]).map((collection) => collection.alias),
    options?.externalAliases ? { externalAliases: options.externalAliases } : { allowExternalAliases: true },
  );
  relay ??= createChangeRelay(data, { includeExternal: true });
  return relay.stream({
    filter: (change) => matchesFilter(filter, change) && canSee(change),
    lastEventId: request.headers.get("Last-Event-ID"),
    signal: request.signal,
  });
}
