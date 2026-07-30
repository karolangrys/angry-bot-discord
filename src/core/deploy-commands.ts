import { REST, Routes } from 'discord.js';
import { env } from './env-config';
import { logger } from './logger';
import { loadCommands } from './command-handler';

async function deployCommands() {
  const commandsCollection = await loadCommands();
  const commands = commandsCollection.map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    let data: any;

    if (env.TEST_GUILD_ID) {
      // Deploy to a specific guild (instant update)
      data = await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.TEST_GUILD_ID), {
        body: commands,
      });
      logger.info(
        `Successfully reloaded ${data.length} guild (/) commands for guild ${env.TEST_GUILD_ID}.`,
      );
    } else {
      // Deploy globally (can take up to an hour to cache)
      data = await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: commands });
      logger.info(`Successfully reloaded ${data.length} global (/) commands.`);
    }
  } catch (error) {
    logger.error(error);
  }
}

deployCommands();
