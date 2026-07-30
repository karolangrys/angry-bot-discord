import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getT, SUPPORTED_LOCALES } from '../../core/i18n';
import locales from './locales';
import { db } from '../../core/db/db-client';
import { guildConfigs } from '../../core/db/schema';
import { logger } from '../../core/logger';

export const data = new SlashCommandBuilder()
  .setName(locales['en-US'].name)
  .setDescription(locales['en-US'].description)
  .setDescriptionLocalizations({
    pl: locales['pl'].description,
  })
  .setDefaultMemberPermissions(0) // Require explicit permissions
  .addSubcommand((subcommand) =>
    subcommand
      .setName(locales['en-US'].language.name)
      .setDescription(locales['en-US'].language.description)
      .setNameLocalizations({
        pl: locales['pl'].language.name,
      })
      .setDescriptionLocalizations({
        pl: locales['pl'].language.description,
      })
      .addStringOption((option) =>
        option
          .setName(locales['en-US'].language.lang_option)
          .setDescription(locales['en-US'].language.lang_desc)
          .setNameLocalizations({
            pl: locales['pl'].language.lang_option,
          })
          .setDescriptionLocalizations({
            pl: locales['pl'].language.lang_desc,
          })
          .setRequired(true)
          .addChoices(
            { name: 'English (US)', value: 'en-US' },
            { name: 'Polski', value: 'pl' }
          )
      )
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const t = await getT(interaction, 'config');

  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: t('no_permission'), ephemeral: true });
    return;
  }

  const lang = interaction.options.getString(locales['en-US'].language.lang_option, true);

  try {
    // Insert or update guild config
    await db
      .insert(guildConfigs)
      .values({ guildId: interaction.guildId!, language: lang })
      .onConflictDoUpdate({
        target: guildConfigs.guildId,
        set: { language: lang },
      });

    // Re-fetch translations with new language for the response
    const newT = await getT({ ...interaction, guildId: interaction.guildId } as any, 'config');
    // Actually, getT fetches from DB, so we can just call it again
    const updatedT = await getT(interaction, 'config'); 
    // Wait, getT fetches from DB, so it will get the newly updated language!

    await interaction.reply({ content: updatedT('success', { lang }), ephemeral: true });
  } catch (error) {
    logger.error(`Error saving config: ${error}`);
    await interaction.reply({ content: t('error'), ephemeral: true });
  }
};
