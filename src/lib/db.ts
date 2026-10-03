import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { __timelock_pool?: Pool };

function getPool(): Pool {
  if (!globalForPg.__timelock_pool) {
    globalForPg.__timelock_pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    globalForPg.__timelock_pool.on("error", (err) => {
      console.error("Unexpected PG pool error:", err);
    });
  }
  return globalForPg.__timelock_pool;
}

export const pool = getPool();

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

export async function queryMany<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function transaction<T = any>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
  globalForPg.__timelock_pool = undefined;
}
