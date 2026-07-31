import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env } from '../env-config';
import * as schema from './schema';

const isInMemory =
  env.DATABASE_URL === ':memory:' ||
  env.DATABASE_URL === '' ||
  env.DATABASE_URL.startsWith('file::memory:');

if (!isInMemory) {
  // The database file usually lives on a mounted volume (data/sqlite.db); bun:sqlite creates the
  // file but not the directory holding it.
  mkdirSync(dirname(env.DATABASE_URL), { recursive: true });
}

export const sqlite = new Database(env.DATABASE_URL, { create: true });

if (!isInMemory) {
  // WAL survives an abrupt container stop far better than the default rollback journal.
  sqlite.exec('PRAGMA journal_mode = WAL;');
}
sqlite.exec('PRAGMA foreign_keys = ON;');
// Rather than failing instantly when another connection (e.g. drizzle-kit studio) holds the lock.
sqlite.exec('PRAGMA busy_timeout = 5000;');

export const db = drizzle(sqlite, { schema });

export function closeDb(): void {
  sqlite.close();
}
