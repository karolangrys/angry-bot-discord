import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getT } from '../../core/i18n';
import { logger } from '../../core/logger';
import { isBotOwner } from '../../core/permissions';
import { applyActivity, MAX_ACTIVITY_LENGTH, restoreActivity, saveActivity } from './activity';
import locales, { NAMESPACE } from './locales';

const STATUS_OPTION = locales['en-US'].status_text.name;

export const data = new SlashCommandBuilder()
  .setName(locales['en-US'].name)
  .setDescription(locales['en-US'].description)
  .setDescriptionLocalizations({
    pl: locales.pl.description,
  })
  // Hide the command from regular members. The presence is process-wide, and the owner check in
  // `execute` is the actual authorisation.
  .setDefaultMemberPermissions(0)
  .addStringOption((option) =>
    option
      .setName(STATUS_OPTION)
      .setDescription(locales['en-US'].status_text.description)
      .setNameLocalizations({
        pl: locales.pl.status_text.name,
      })
      .setDescriptionLocalizations({
        pl: locales.pl.status_text.description,
      })
      .setRequired(true)
      .setMaxLength(MAX_ACTIVITY_LENGTH),
  );

export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const t = await getT(interaction, NAMESPACE);

  // Deliberately not ManageGuild: the presence is visible on every server the bot is in, so a
  // single guild's administrator must not be able to change it.
  if (!(await isBotOwner(interaction))) {
    await interaction.reply({ content: t('no_permission'), flags: MessageFlags.Ephemeral });
    return;
  }

  const status = interaction.options.getString(STATUS_OPTION, true);

  try {
    applyActivity(interaction.client, status);
    // Discord drops the presence on disconnect, so persist it and re-apply it on the next ready.
    await saveActivity(status);
  } catch (error) {
    logger.error('Error setting the bot status:', error);
    await interaction.reply({ content: t('error'), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({
    content: t('success', { status }),
    flags: MessageFlags.Ephemeral,
  });
};

/** Runs once the gateway is ready (see the `onReady` hook on the Command interface). */
export const onReady = restoreActivity;
