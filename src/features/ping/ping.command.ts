import type { ChatInputCommandInteraction } from 'discord.js';
import { createLocalizedCommand } from '../../core/command-builder';
import { getT } from '../../core/i18n';
import locales, { NAMESPACE } from './locales';

export const data = createLocalizedCommand(locales);

export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const t = await getT(interaction, NAMESPACE);

  // Deferring measures the real round-trip without the deprecated `fetchReply` option.
  await interaction.deferReply();

  const latency = Date.now() - interaction.createdTimestamp;
  // `ws.ping` is -1 until the first heartbeat has been acknowledged.
  const gateway = Math.max(0, Math.round(interaction.client.ws.ping));

  await interaction.editReply(t('response', { latency, gateway }));
};
