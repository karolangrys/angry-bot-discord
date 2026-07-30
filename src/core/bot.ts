import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { logger } from './logger';
import { loadCommands, Command } from './command-handler';
import { env } from './env-config';

export class DiscordBot {
  public client: Client;
  public commands: Collection<string, Command>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.commands = new Collection();
  }

  public async start() {
    this.registerEvents();

    // Load all commands from features
    this.commands = await loadCommands();

    try {
      await this.client.login(env.DISCORD_TOKEN);
      logger.info('Bot is connecting...');
    } catch (error) {
      logger.error(`Failed to login: ${error}`);
      process.exit(1);
    }
  }

  private registerEvents() {
    this.client.once(Events.ClientReady, () => {
      logger.info(`Logged in as ${this.client.user?.tag}!`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}: ${error}`);

        const errorMessage = 'Wystąpił błąd podczas wykonywania tej komendy!';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });
  }
}
