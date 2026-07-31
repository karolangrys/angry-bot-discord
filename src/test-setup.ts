/**
 * Test bootstrap, wired up through `bunfig.toml` (`[test].preload`).
 *
 * It exists because the suite used to depend on a developer's local `.env`: `env-config.ts` calls
 * `process.exit(1)` when DISCORD_TOKEN is missing, so `bun test` died instantly on a fresh clone
 * and could never have passed in CI.
 *
 * Environment variables must be set before anything that reads them is imported, hence the dynamic
 * imports below.
 */

import { TEST_OWNER_ID } from './test-support';

// Fixed dummy credentials: no test may ever reach the real Discord API.
process.env.DISCORD_TOKEN = 'test-discord-token';
process.env.CLIENT_ID = 'test-client-id';
delete process.env.TEST_GUILD_ID;

// Makes `isBotOwner` resolve against a known ID instead of calling the Discord API.
process.env.OWNER_IDS = TEST_OWNER_ID;

// A throwaway database per run, so tests never touch a real sqlite.db.
process.env.DATABASE_URL = ':memory:';
process.env.NODE_ENV = 'test';

const { runMigrations } = await import('./core/db/migrate');
const { initI18n } = await import('./core/i18n');

// Running the real migrations means the committed `drizzle/` folder is exercised on every test run.
runMigrations();

// Real translations instead of a mocked `getT`. This is what makes a namespace mismatch, such as
// the one `admin-status` shipped with, actually fail a test.
await initI18n();
