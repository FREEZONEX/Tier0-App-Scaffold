import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const connectionString =
  process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;

const pool = globalForDb.pool ?? new Pool({ connectionString, max: 5 });

export const db = drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}
