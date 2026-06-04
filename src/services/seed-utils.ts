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
