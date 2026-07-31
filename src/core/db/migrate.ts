import { join } from 'node:path';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { logger } from '../logger';
import { db } from './db-client';

/** Resolved from this file's location so it works regardless of the working directory. */
const MIGRATIONS_FOLDER = join(import.meta.dir, '..', '..', '..', 'drizzle');

/**
 * Applies pending migrations. Called on every startup: the production image only ships
 * `drizzle-orm` (not the `drizzle-kit` CLI), and previously nothing created the tables at all,
 * so every command failed against an empty database.
 */
export function runMigrations(): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  logger.debug('Database migrations are up to date.');
}
