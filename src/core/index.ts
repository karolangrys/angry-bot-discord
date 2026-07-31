import { DiscordBot } from './bot';
import { closeDb } from './db/db-client';
import { runMigrations } from './db/migrate';
import { initI18n } from './i18n';
import { flushLogs, logger } from './logger';

const bot = new DiscordBot();
let shuttingDown = false;

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function shutdown(code: number, reason: string): Promise<never> {
  if (shuttingDown) {
    // A second signal means someone is impatient — leave right away.
    process.exit(code);
  }
  shuttingDown = true;
  logger.info(`Shutting down (${reason})...`);

  try {
    const cleanup = async () => {
      await bot.stop();
      closeDb();
    };
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown timed out')), SHUTDOWN_TIMEOUT_MS),
    );
    await Promise.race([cleanup(), timeout]);
  } catch (error) {
    logger.error('Error while shutting down:', error);
  }

  await flushLogs();
  process.exit(code);
}

// Docker sends SIGTERM on `stop`/`up -d`; without this the process dies mid-write to SQLite.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown(0, signal));
}

// Both of these leave the process in an undefined state, so restarting is safer than continuing.
// `restart: unless-stopped` in docker-compose brings the bot back up.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  void shutdown(1, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
  void shutdown(1, 'unhandledRejection');
});

async function main(): Promise<void> {
  runMigrations();
  await initI18n();
  await bot.start();
}

main().catch(async (error) => {
  logger.error('Fatal error during startup:', error);
  await shutdown(1, 'startup failure');
});
