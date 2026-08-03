import { Team, type RepliableInteraction } from 'discord.js';
import { env } from './env-config';
import { logger } from './logger';

/**
 * Owner check for commands whose effect is process-wide rather than guild-scoped.
 *
 * A guild-level permission such as `ManageGuild` is not sufficient for those: it would let an
 * administrator of any single server change behaviour visible on every server the bot is in.
 *
 * Uses `OWNER_IDS` when configured, otherwise the application owner (user or team) reported by
 * Discord.
 *
 * Takes any repliable interaction so modal submissions can be re-checked: a `customId` is supplied
 * by the client and is not evidence of authorisation.
 */
export async function isBotOwner(interaction: RepliableInteraction): Promise<boolean> {
  if (env.OWNER_IDS.length > 0) {
    return env.OWNER_IDS.includes(interaction.user.id);
  }

  try {
    const application = interaction.client.application;
    const owner = application.owner ?? (await application.fetch()).owner;

    if (owner instanceof Team) {
      return owner.members.has(interaction.user.id);
    }

    return owner?.id === interaction.user.id;
  } catch (error) {
    // Denying access is the safe outcome when ownership cannot be established.
    logger.error('Could not determine the application owner:', error);
    return false;
  }
}
