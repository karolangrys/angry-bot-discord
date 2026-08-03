import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'Discord token is required'),
  CLIENT_ID: z.string().min(1, 'Client ID is required'),
  /** When set, slash commands are registered for this guild only (updates are instant). */
  TEST_GUILD_ID: z.string().optional(),
  /**
   * Comma-separated Discord user IDs allowed to run process-wide commands such as `/status`.
   * When empty, the application owner reported by Discord is used instead.
   */
  OWNER_IDS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  DATABASE_URL: z.string().min(1).default('sqlite.db'),
  LOG_DIR: z.string().min(1).default('logs'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /**
   * IANA timezone the cron expressions of `/js-task` are interpreted in.
   *
   * Needed because nothing sets `TZ`, so the container runs in UTC: without this, `0 9 * * *`
   * would fire at 11:00 Polish time in summer and 10:00 in winter, shifting with DST.
   */
  CRON_TIMEZONE: z.string().min(1).default('Europe/Warsaw'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // `console.error` is deliberate here: logger.ts imports this module, so reaching for the
    // Winston logger would create an import cycle. Do not "fix" this to use the logger.
    console.error('Invalid environment variables:', parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
};

/** Validated at import time so a misconfigured deployment fails immediately, not mid-request. */
export const env = parseEnv();
