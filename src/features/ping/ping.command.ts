import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getT } from '../../core/i18n';
import locales from './locales';

export const data = new SlashCommandBuilder()
  .setName(locales['en-US'].name)
  .setDescription(locales['en-US'].description)
  .setDescriptionLocalizations({
    pl: locales['pl'].description,
  });

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const t = await getT(interaction, 'ping');
  const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  
  await interaction.editReply(t('response', { latency }));
};
