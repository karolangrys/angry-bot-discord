import {
  SlashCommandBuilder,
  TimestampStyles,
  time,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getT } from '../../core/i18n';
import locales, { NAMESPACE } from './locales';

const TARGET_OPTION = locales['en-US'].target.name;

export const data = new SlashCommandBuilder()
  .setName(locales['en-US'].name)
  .setDescription(locales['en-US'].description)
  .setDescriptionLocalizations({
    pl: locales.pl.description,
  })
  .addUserOption((option) =>
    option
      .setName(TARGET_OPTION)
      .setDescription(locales['en-US'].target.description)
      .setNameLocalizations({
        pl: locales.pl.target.name,
      })
      .setDescriptionLocalizations({
        pl: locales.pl.target.description,
      })
      .setRequired(false),
  );

export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const t = await getT(interaction, NAMESPACE);
  const targetUser = interaction.options.getUser(TARGET_OPTION) ?? interaction.user;

  await interaction.reply({
    content: t('response', {
      // `displayName` is the global name; `tag` renders as "name#0" for migrated accounts.
      name: targetUser.displayName,
      username: targetUser.username,
      id: targetUser.id,
      // Rendered in each viewer's own locale and timezone rather than the server process locale.
      createdAt: time(targetUser.createdAt, TimestampStyles.LongDate),
    }),
  });
};
