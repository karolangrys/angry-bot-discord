import {
  REST,
  Routes,
  type RESTPutAPIApplicationCommandsResult,
  type RESTPutAPIApplicationGuildCommandsResult,
} from 'discord.js';
import { loadCommands } from './command-handler';
import { env } from './env-config';
import { flushLogs, logger } from './logger';

async function deployCommands(): Promise<void> {
  const commandsCollection = await loadCommands();
  const commands = commandsCollection.map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  logger.info(`Started refreshing ${commands.length} application (/) commands.`);

  if (env.TEST_GUILD_ID) {
    // Guild-scoped registration updates instantly, which is what you want while developing.
    const data = (await rest.put(
      Routes.applicationGuildCommands(env.CLIENT_ID, env.TEST_GUILD_ID),
      { body: commands },
    )) as RESTPutAPIApplicationGuildCommandsResult;
    logger.info(
      `Successfully reloaded ${data.length} guild (/) commands for guild ${env.TEST_GUILD_ID}.`,
    );
    return;
  }

  // Global registration can take up to an hour to propagate through Discord's cache.
  const data = (await rest.put(Routes.applicationCommands(env.CLIENT_ID), {
    body: commands,
  })) as RESTPutAPIApplicationCommandsResult;
  logger.info(`Successfully reloaded ${data.length} global (/) commands.`);
}

try {
  await deployCommands();
  await flushLogs();
} catch (error) {
  // The exit code matters: the old version swallowed failures and exited 0, so a deployment that
  // never registered its commands still looked green in CI.
  logger.error('Failed to deploy application commands:', error);
  await flushLogs();
  process.exit(1);
}
