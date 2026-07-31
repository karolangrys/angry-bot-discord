import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { loadCommands, type Command } from './command-handler';
import { env } from './env-config';
import { getT } from './i18n';
import { NAMESPACE as CORE_NAMESPACE } from './locales';
import { logger } from './logger';

type CoreErrorKey = 'command_error' | 'command_unknown';

export class DiscordBot {
  public readonly client: Client;
  public commands: Collection<string, Command>;

  constructor() {
    this.client = new Client({
      // Only what is actually used. GuildMessages/MessageContent were never read, and
      // MessageContent is a privileged intent that blocks login unless it is enabled in the
      // Discord Developer Portal.
      intents: [GatewayIntentBits.Guilds],
    });
    this.commands = new Collection();
  }

  /** Throws on failure; the caller decides how to shut down. */
  public async start(): Promise<void> {
    this.commands = await loadCommands();
    this.registerEvents();

    logger.info('Bot is connecting...');
    await this.client.login(env.DISCORD_TOKEN);
  }

  public async stop(): Promise<void> {
    await this.client.destroy();
  }

  private registerEvents(): void {
    this.client.once(Events.ClientReady, (client) => {
      logger.info(`Logged in as ${client.user.tag} — ${this.commands.size} command(s) ready.`);
      void this.runReadyHooks(client);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      const command = this.commands.get(interaction.commandName);

      if (!command) {
        // Usually a stale registration: the command was removed but Discord still shows it.
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        await this.replyWithError(interaction, 'command_unknown');
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);
        await this.replyWithError(interaction, 'command_error');
      }
    });
  }

  private async runReadyHooks(client: Client<true>): Promise<void> {
    for (const [name, command] of this.commands) {
      if (!command.onReady) {
        continue;
      }
      try {
        await command.onReady(client);
      } catch (error) {
        logger.error(`The onReady hook of command ${name} failed:`, error);
      }
    }
  }

  private async replyWithError(
    interaction: ChatInputCommandInteraction,
    key: CoreErrorKey,
  ): Promise<void> {
    try {
      const t = await getT(interaction, CORE_NAMESPACE);
      const payload = { content: t(key), flags: MessageFlags.Ephemeral } as const;

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (error) {
      // This runs inside an async event handler, so an unguarded throw here becomes an unhandled
      // rejection. Expired interaction tokens (error 10062 Unknown interaction) are common.
      logger.error('Could not deliver the error message to the user:', error);
    }
  }
}
