/**
 * Helpers for service runtime bootstrap seed data.
 *
 * Drizzle omits object properties whose values are undefined. In INSERT SQL
 * that becomes `default`, which is especially dangerous for non-null foreign
 * keys because a missing parent id only fails once the query reaches Postgres.
 * Use these helpers while constructing baseline records so broken seed graphs
 * fail with a precise message before db.insert(...).values(...).
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

export function requireSeedRef<T extends { id: string }>(
  rows: readonly T[],
  index: number,
  label: string,
): string {
  return requireSeedValue(rows[index]?.id, `${label}[${index}].id`);
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Produces a PostgreSQL `date` value relative to the current UTC day.
 *
 * Drizzle `date()` columns use `YYYY-MM-DD` strings. Keeping this conversion in
 * one helper prevents runtime seed code from accidentally passing a numeric
 * result from `Date#setDate()` or an unencoded Date object into raw SQL.
 */
export function seedDate(offsetDays = 0): string {
  assertSeedNumber(offsetDays, "offsetDays");
  return new Date(seedDayStart() + offsetDays * DAY_IN_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Produces a Drizzle `timestamp()` value relative to the current UTC day.
 *
 * The returned value is always a valid Date at a deterministic hour, so
 * related baseline records can span lifecycle states without hand-written
 * date mutation or database-specific interval SQL.
 */
export function seedTimestamp(offsetDays = 0, utcHour = 9): Date {
  assertSeedNumber(offsetDays, "offsetDays");
  assertSeedNumber(utcHour, "utcHour");
  if (!Number.isInteger(utcHour) || utcHour < 0 || utcHour > 23) {
    throw new Error(`Invalid seed utcHour: ${utcHour}`);
  }
  return new Date(seedDayStart() + offsetDays * DAY_IN_MS + utcHour * 60 * 60 * 1000);
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
