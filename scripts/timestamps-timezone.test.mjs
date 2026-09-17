// Run: TEST_DATABASE_URL=postgresql://... node --import tsx --test scripts/timestamps-timezone.test.mjs
// Uses one rollback-only transaction and a temporary table; never touches app tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { pgTable, integer, getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { timestamps } from '../src/db/schema.ts';

test('database defaults and explicit Date values use the same UTC audit time', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname), 'use a local test database');
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const db = drizzle(client);
  const audit = pgTable('timestamp_default_test', { id: integer('id').primaryKey(), ...timestamps });
  const dialect = new PgDialect();
  const columns = getTableConfig(audit).columns.filter(c => c.name !== 'id');
  try {
    await client.query('BEGIN');
    const definition = columns.map(c => `"${c.name}" ${c.getSQLType()} NOT NULL DEFAULT ${dialect.sqlToQuery(c.default).sql}`).join(', ');
    await client.query(`CREATE TEMPORARY TABLE timestamp_default_test (id integer primary key, ${definition}) ON COMMIT DROP`);
    const { rows: [clock] } = await client.query('SELECT now() AS instant');
    for (const [i, zone] of ['UTC', 'Asia/Shanghai', 'America/New_York'].entries()) {
      await client.query("SELECT set_config('TimeZone', $1, true)", [zone]);
      const [defaults] = await db.insert(audit).values({ id: i * 2 }).returning();
      const [explicit] = await db.insert(audit).values({ id: i * 2 + 1, createdAt: clock.instant, updatedAt: clock.instant }).returning();
      assert.equal(defaults.createdAt.toISOString(), explicit.createdAt.toISOString(), zone + ' created_at');
      assert.equal(defaults.updatedAt.toISOString(), explicit.updatedAt.toISOString(), zone + ' updated_at');
      const [updated] = await db.update(audit).set({ id: i * 2 }).where(eq(audit.id, i * 2)).returning();
      assert.ok(Math.abs(updated.updatedAt.getTime() - Date.now()) < 2000, zone + ' $onUpdateFn');
    }
    assert.equal(columns[0].getSQLType(), 'timestamp', 'column type remains unchanged');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
