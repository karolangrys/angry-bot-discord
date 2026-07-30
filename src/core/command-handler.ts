import { Collection, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const featuresPath = join(process.cwd(), 'src', 'features');

  try {
    const featureFolders = readdirSync(featuresPath);

    for (const folder of featureFolders) {
      const featurePath = join(featuresPath, folder);

      // Look for files ending with .command.ts
      const commandFiles = readdirSync(featurePath).filter((file) => file.endsWith('.command.ts'));

      for (const file of commandFiles) {
        const filePath = join(featurePath, file);
        // Using dynamic import in Bun
        const commandModule = await import(filePath);

        if ('data' in commandModule && 'execute' in commandModule) {
          commands.set(commandModule.data.name, commandModule as Command);
          logger.debug(`Loaded command: ${commandModule.data.name} from feature: ${folder}`);
        } else {
          logger.warn(
            `The command at ${filePath} is missing a required "data" or "execute" property.`,
          );
        }
      }
    }
  } catch (error) {
    logger.error(`Error loading commands: ${error}`);
  }

  return commands;
}
