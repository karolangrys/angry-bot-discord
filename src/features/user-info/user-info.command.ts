import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getT } from '../../core/i18n';
import locales from './locales';

export const data = new SlashCommandBuilder()
  .setName(locales['en-US'].name)
  .setDescription(locales['en-US'].description)
  .setDescriptionLocalizations({
    pl: locales['pl'].description,
  })
  .addUserOption(option => 
    option.setName(locales['en-US'].target.name)
      .setDescription(locales['en-US'].target.description)
      .setNameLocalizations({
        pl: locales['pl'].target.name,
      })
      .setDescriptionLocalizations({
        pl: locales['pl'].target.description,
      })
      .setRequired(false)
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const t = await getT(interaction, 'user-info');
  const targetUser = interaction.options.getUser(locales['en-US'].target.name) || interaction.user;
  
  await interaction.reply({
    content: t('response', {
      tag: targetUser.tag,
      id: targetUser.id,
      createdAt: targetUser.createdAt.toLocaleDateString(),
    }),
  });
};
