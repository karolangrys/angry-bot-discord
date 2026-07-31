import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  TimestampStyles,
  time,
  userMention,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getT } from '../../core/i18n';
import locales, { NAMESPACE } from './locales';

export const data = new SlashCommandBuilder()
  .setName(locales['en-US'].name)
  .setDescription(locales['en-US'].description)
  .setDescriptionLocalizations({
    pl: locales.pl.description,
  })
  .setContexts(InteractionContextType.Guild);

export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const t = await getT(interaction, NAMESPACE);

  // `setContexts` blocks DMs; this stays as defence in depth for stale registrations.
  if (!interaction.guild) {
    await interaction.reply({ content: t('not_in_guild'), flags: MessageFlags.Ephemeral });
    return;
  }

  const { name, memberCount, createdAt, ownerId } = interaction.guild;

  await interaction.reply({
    content: t('response', {
      name,
      memberCount,
      // A Discord timestamp renders in each viewer's own locale and timezone, unlike
      // `toLocaleDateString()`, which used whatever locale the server process happened to have.
      createdAt: time(createdAt, TimestampStyles.LongDate),
      owner: userMention(ownerId),
    }),
  });
};
