import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Per-guild settings. */
export const guildConfigs = sqliteTable('guild_configs', {
  guildId: text('guild_id').primaryKey(),
  /** Reserved for a future message-command feature; nothing reads it yet. */
  prefix: text('prefix').default('!').notNull(),
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
