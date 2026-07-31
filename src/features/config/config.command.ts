import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { createLocalizedCommand } from '../../core/command-builder';
import { db } from '../../core/db/db-client';
import { guildConfigs } from '../../core/db/schema';
import { getT, invalidateGuildLanguage, isSupportedLocale } from '../../core/i18n';
import { logger } from '../../core/logger';
import locales, { LANGUAGE_CHOICES, NAMESPACE } from './locales';

const LANGUAGE_SUBCOMMAND = locales['en-US'].language.name;
const LANGUAGE_OPTION = locales['en-US'].language.lang_option;

export const data = createLocalizedCommand(locales)
  .setDefaultMemberPermissions(0) // Require explicit permissions.
  // Everything here writes per-guild configuration, so there is nothing to do in a DM.
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(LANGUAGE_SUBCOMMAND)
      .setDescription(locales['en-US'].language.description)
      .setNameLocalizations({
        pl: locales.pl.language.name,
      })
      .setDescriptionLocalizations({
        pl: locales.pl.language.description,
      })
      .addStringOption((option) =>
        option
          .setName(LANGUAGE_OPTION)
          .setDescription(locales['en-US'].language.lang_desc)
          .setNameLocalizations({
            pl: locales.pl.language.lang_option,
          })
          .setDescriptionLocalizations({
            pl: locales.pl.language.lang_desc,
          })
          .setRequired(true)
          .addChoices(...LANGUAGE_CHOICES),
      ),
  );

export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const t = await getT(interaction, NAMESPACE);

  // `setContexts` already blocks DMs, but the guard also narrows guildId/memberPermissions so the
  // code below needs no non-null assertions.
  if (!interaction.inGuild()) {
    await interaction.reply({ content: t('guild_only'), flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: t('no_permission'), flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand !== LANGUAGE_SUBCOMMAND) {
    // Without this branch, a subcommand added later would silently fall through to the language logic.
    logger.warn(`Unhandled /${locales['en-US'].name} subcommand: ${subcommand}`);
    await interaction.reply({ content: t('error'), flags: MessageFlags.Ephemeral });
    return;
  }

  const language = interaction.options.getString(LANGUAGE_OPTION, true);
  if (!isSupportedLocale(language)) {
    logger.warn(`Rejected unsupported language "${language}" for guild ${interaction.guildId}.`);
    await interaction.reply({ content: t('error'), flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await db
      .insert(guildConfigs)
      .values({ guildId: interaction.guildId, language })
      .onConflictDoUpdate({
        target: guildConfigs.guildId,
        set: { language },
      });

    // The resolved language is cached per guild; without this the old value would keep being served.
    invalidateGuildLanguage(interaction.guildId);
  } catch (error) {
    logger.error('Error saving the guild configuration:', error);
    await interaction.reply({ content: t('error'), flags: MessageFlags.Ephemeral });
    return;
  }

  // Re-resolve so the confirmation is rendered in the language that was just selected.
  const updatedT = await getT(interaction, NAMESPACE);
  await interaction.reply({
    content: updatedT('success', { lang: language }),
    flags: MessageFlags.Ephemeral,
  });
};
