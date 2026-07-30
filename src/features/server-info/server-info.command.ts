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
  const t = await getT(interaction, 'server-info');

  if (!interaction.guild) {
    await interaction.reply({ content: t('not_in_guild'), ephemeral: true });
    return;
  }

  const { name, memberCount, createdAt, ownerId } = interaction.guild;
  
  await interaction.reply({
    content: t('response', {
      name,
      memberCount,
      createdAt: createdAt.toLocaleDateString(),
      ownerId,
    }),
  });
};
