import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Per-guild settings. */
export const guildConfigs = sqliteTable('guild_configs', {
  guildId: text('guild_id').primaryKey(),
  /** One of SUPPORTED_LOCALES, or null to follow the user's Discord client language. */
  language: text('language'),
});

/** Per-user counters. */
export const userConfigs = sqliteTable('user_configs', {
  userId: text('user_id').primaryKey(),
  /** Reserved for a future levelling feature; nothing reads it yet. */
  experience: integer('experience').default(0).notNull(),
});

/** Key/value store for process-wide state that has to survive a restart (e.g. the bot presence). */
export const botSettings = sqliteTable('bot_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/** User-supplied JavaScript executed on a cron schedule by the `js-task` feature (owner only). */
export const scheduledScripts = sqliteTable('scheduled_scripts', {
  name: text('name').primaryKey(),
  /** Cron expression, interpreted in `env.CRON_TIMEZONE`. */
  cron: text('cron').notNull(),
  code: text('code').notNull(),
  /** Channel the return value is posted to. */
  channelId: text('channel_id').notNull(),
  /**
   * Disabled tasks are never scheduled. A task whose dry run failed, or whose cron expression is
   * invalid, is stored disabled rather than rejected, so the author never loses the code they wrote.
   */
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  /** Truncated preview of the last result, for `/js-task show`; not enough to rebuild the message. */
  lastResult: text('last_result'),
  lastError: text('last_error'),
});

/**
 * Per-script key/value state, exposed to the sandbox as `store`. Keys prefixed `secret:` hold
 * credentials written via `/js-task secret set`, so they never appear in the script source.
 */
export const scriptStore = sqliteTable(
  'script_store',
  {
    scriptName: text('script_name')
      .notNull()
      .references(() => scheduledScripts.name, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
  },
  // `PRAGMA foreign_keys = ON` in db-client.ts makes the cascade real, so deleting a task also
  // drops its stored state and secrets without extra code.
  (table) => ({ pk: primaryKey({ columns: [table.scriptName, table.key] }) }),
);
