/**
 * Helpers for first-load seed data of app-owned UNS collections.
 *
 * Seed records are plain JSON returned by the `seed` option of `defineAppCollection`
 * (see `@/lib/uns.server`). Build them with fixed, readable record ids so a
 * second process or a retry only hits 409 (already exists) instead of creating
 * duplicates. Use these helpers so a broken seed graph (a child pointing at a
 * parent that was never declared) fails with a precise message before the
 * first write reaches UNS.
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
 * A calendar date (`YYYY-MM-DD`) relative to the current UTC day.
 *
 * ISO date strings sort and range-filter correctly as text in UNS
 * (`filter: { dueDate: { lt: seedDate(7) } }`). Never build seed values with
 * mutating Date setters (`setDate()` returns a number).
 */
export function seedDate(offsetDays = 0): string {
  assertSeedNumber(offsetDays, "offsetDays");
  return new Date(seedDayStart() + offsetDays * DAY_IN_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * A timestamp (ISO 8601 string, UTC) relative to the current UTC day at a
 * deterministic hour, so related baseline records can span lifecycle states.
 * Use `seedTimeMs()` instead for fields the app treats as Unix milliseconds.
 */
export function seedTimestamp(offsetDays = 0, utcHour = 9): string {
  return new Date(seedTimeMs(offsetDays, utcHour)).toISOString();
}

/** Same instant as `seedTimestamp()`, as Unix milliseconds. */
export function seedTimeMs(offsetDays = 0, utcHour = 9): number {
  assertSeedNumber(offsetDays, "offsetDays");
  assertSeedNumber(utcHour, "utcHour");
  if (!Number.isInteger(utcHour) || utcHour < 0 || utcHour > 23) {
    throw new Error(`Invalid seed utcHour: ${utcHour}`);
  }
  return seedDayStart() + offsetDays * DAY_IN_MS + utcHour * 60 * 60 * 1000;
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
