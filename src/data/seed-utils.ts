/**
 * Helpers for `seed` documents in `src/data/collections.ts`.
 *
 * Seeds are inserted once, when ensure creates the collection. Give every
 * seed document a fixed `_id` and reference other seeds by those IDs; use
 * these helpers so a broken seed graph fails with a precise message at build
 * time (the data contract test parses every seed) instead of storing a
 * dangling reference.
 */
export function requireSeedValue<T>(
  value: T | null | undefined,
  label: string,
): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Missing seed value: ${label}`);
  }
  return value;
}

export function requireSeedRef<T extends { _id: string }>(
  rows: readonly T[],
  index: number,
  label: string,
): string {
  return requireSeedValue(rows[index]?._id, `${label}[${index}]._id`);
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * A "YYYY-MM-DD" date relative to the current UTC day — the storage format
 * for date-only fields (it sorts and range-filters as a string).
 */
export function seedDate(offsetDays = 0): string {
  assertSeedNumber(offsetDays, "offsetDays");
  return new Date(seedDayStart() + offsetDays * DAY_IN_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * An ISO-8601 UTC instant relative to the current UTC day at a deterministic
 * hour — the storage format for timestamps (`toISOString()` output sorts and
 * range-filters as a string).
 */
export function seedTimestamp(offsetDays = 0, utcHour = 9): string {
  assertSeedNumber(offsetDays, "offsetDays");
  assertSeedNumber(utcHour, "utcHour");
  if (!Number.isInteger(utcHour) || utcHour < 0 || utcHour > 23) {
    throw new Error(`Invalid seed utcHour: ${utcHour}`);
  }
  return new Date(seedDayStart() + offsetDays * DAY_IN_MS + utcHour * 60 * 60 * 1000).toISOString();
}

function seedDayStart(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function assertSeedNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid seed ${label}: ${value}`);
  }
}
