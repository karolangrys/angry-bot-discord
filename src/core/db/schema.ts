import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Example schema for guild configurations
export const guildConfigs = sqliteTable('guild_configs', {
  guildId: text('guild_id').primaryKey(),
  prefix: text('prefix').default('!').notNull(),
  language: text('language'),
  // Add other global guild settings here
});

// Example schema for user configurations/stats
export const userConfigs = sqliteTable('user_configs', {
  userId: text('user_id').primaryKey(),
  experience: integer('experience').default(0).notNull(),
  // Add other global user settings here
});
