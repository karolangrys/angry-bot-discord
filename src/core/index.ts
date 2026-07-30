import { DiscordBot } from './bot';
import { logger } from './logger';
import { initI18n } from './i18n';

const bot = new DiscordBot();

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

async function main() {
  await initI18n();
  bot.start().catch((error) => {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  });
}

main();
