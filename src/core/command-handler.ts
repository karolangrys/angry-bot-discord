import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  Collection,
  type ChatInputCommandInteraction,
  type Client,
  type SlashCommandBuilder,
} from 'discord.js';
import { logger } from './logger';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /**
   * Optional hook run once the gateway connection is ready. Lets a feature restore its own state
   * (see `admin-status`) without core needing to know that the feature exists.
   */
  onReady?: (client: Client<true>) => Promise<void> | void;
}

/** Resolved from this file's location rather than `process.cwd()`, so the bot starts from any directory. */
export const FEATURES_PATH = join(import.meta.dir, '..', 'features');

const COMMAND_FILE = /\.command\.(ts|js)$/;

export function listFeatureFolders(): string[] {
  // `withFileTypes` matters: a stray file in src/features made the old code throw ENOTDIR and
  // abandon command loading entirely.
  return readdirSync(FEATURES_PATH, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function isCommand(value: unknown): value is Command {
  const candidate = value as Partial<Command> | null | undefined;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.execute === 'function' &&
    typeof candidate.data === 'object' &&
    candidate.data !== null &&
    typeof candidate.data.name === 'string' &&
    candidate.data.name.length > 0 &&
    typeof candidate.data.toJSON === 'function' &&
    (candidate.onReady === undefined || typeof candidate.onReady === 'function')
  );
}

export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();

  for (const folder of listFeatureFolders()) {
    const featurePath = join(FEATURES_PATH, folder);

    let commandFiles: string[];
    try {
      commandFiles = readdirSync(featurePath).filter((file) => COMMAND_FILE.test(file));
    } catch (error) {
      logger.error(`Could not read feature folder ${folder}:`, error);
      continue;
    }

    for (const file of commandFiles) {
      const filePath = join(featurePath, file);
      try {
        // `import()` needs a file:// URL. A bare Windows path such as C:\... is rejected with
        // ERR_UNSUPPORTED_ESM_URL_SCHEME because "c:" looks like a protocol.
        const commandModule: unknown = await import(pathToFileURL(filePath).href);

        if (!isCommand(commandModule)) {
          logger.warn(`Skipping ${filePath}: no valid "data" / "execute" export.`);
          continue;
        }

        if (commands.has(commandModule.data.name)) {
          logger.warn(
            `Duplicate command name "${commandModule.data.name}" in ${filePath}; keeping the one loaded first.`,
          );
          continue;
        }

        commands.set(commandModule.data.name, commandModule);
        logger.debug(`Loaded command ${commandModule.data.name} from feature ${folder}.`);
      } catch (error) {
        // Scoped per file so one broken feature cannot stop the remaining ones from loading.
        logger.error(`Failed to load command ${filePath}:`, error);
      }
    }
  }

  if (commands.size === 0) {
    // Starting with zero commands is never intentional; fail loudly instead of connecting a
    // bot that silently answers nothing.
    throw new Error(`No commands could be loaded from ${FEATURES_PATH}.`);
  }

  return commands;
}
