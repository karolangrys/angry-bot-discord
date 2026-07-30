import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env } from '../env-config';
import * as schema from './schema';

// Create a new SQLite database connection
const sqlite = new Database(env.DATABASE_URL);

// Export the Drizzle ORM instance
export const db = drizzle(sqlite, { schema });
