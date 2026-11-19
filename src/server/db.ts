import { createClient, type Client, type InValue } from '@libsql/client';
import { mkdirSync } from 'fs';
import path from 'path';
import { migrate } from './migrations';

/**
 * Database: a local SQLite file by default (zero setup), or a hosted libSQL/Turso
 * database when DATABASE_URL points to one (needed on Vercel, whose disk is not persistent).
 *
 *   DATABASE_URL=file:./data/yoisho.db            (default)
 *   DATABASE_URL=libsql://your-db.turso.io  + DATABASE_AUTH_TOKEN=...
 */

let client: Client | null = null;
let ready: Promise<void> | null = null;

function connect(): Client {
  if (client) return client;
  const url = process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'data', 'yoisho.db')}`;
  if (url.startsWith('file:')) mkdirSync(path.dirname(url.slice(5)), { recursive: true });
  client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  return client;
}

/** Returns a ready database (schema created on first use). */
export async function db(): Promise<Client> {
  const c = connect();
  ready ??= (async () => {
    await c.execute('pragma foreign_keys = on');
    await migrate(c);
  })().catch((e) => {
    ready = null; // retry on the next request instead of failing forever
    throw e;
  });
  await ready;
  return c;
}

export type Row = Record<string, unknown>;

export async function all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const c = await db();
  const r = await c.execute({ sql, args });
  return r.rows.map((row) => ({ ...row }) as T);
}

export async function one<T = Row>(sql: string, args: InValue[] = []): Promise<T | null> {
  return (await all<T>(sql, args))[0] ?? null;
}

export async function run(sql: string, args: InValue[] = []) {
  const c = await db();
  await c.execute('pragma foreign_keys = on');
  return c.execute({ sql, args });
}
