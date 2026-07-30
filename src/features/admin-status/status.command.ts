import { SlashCommandBuilder, ChatInputCommandInteraction, ActivityType } from 'discord.js';
import { logger } from '../../core/logger';
import { getT } from '../../core/i18n';
import locales from './locales';

export const data = new SlashCommandBuilder()
  .setName(locales['en-US'].name)
  .setDescription(locales['en-US'].description)
  .setDescriptionLocalizations({
    pl: locales['pl'].description,
  })
  .addStringOption(option => 
    option.setName(locales['en-US'].opis.name)
      .setDescription(locales['en-US'].opis.description)
      .setNameLocalizations({
        pl: locales['pl'].opis.name,
      })
      .setDescriptionLocalizations({
        pl: locales['pl'].opis.description,
      })
      .setRequired(true)
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const t = await getT(interaction, 'status');

  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: t('no_permission'), ephemeral: true });
    return;
  }

  const opis = interaction.options.getString(locales['en-US'].opis.name, true);
  
  try {
    interaction.client.user.setActivity(opis, { type: ActivityType.Custom });
    await interaction.reply({ content: t('success', { opis }), ephemeral: true });
  } catch (error) {
    logger.error(`Error setting status: ${error}`);
    await interaction.reply({ content: t('error'), ephemeral: true });
  }
};
