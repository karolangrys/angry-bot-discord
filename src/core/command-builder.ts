import { SlashCommandBuilder } from 'discord.js';
import type { LocaleBundle } from './i18n-config';

/**
 * Creates a SlashCommandBuilder with localized name and description pre-configured.
 *
 * Every feature's `locales.ts` already carries the name and description per locale, so this
 * helper eliminates the repeated `.setName()` / `.setDescriptionLocalizations()` boilerplate
 * that every command file used to spell out manually.
 *
 * The returned builder can be further customised with options, subcommands, permissions, etc.
 */
export function createLocalizedCommand<T extends { name: string; description: string }>(
  locales: LocaleBundle<T>,
): SlashCommandBuilder {
  const keys = Object.keys(locales) as (keyof typeof locales)[];
  const defaultLocale = keys[0];
  const defaultStrings = locales[defaultLocale];

  const descriptionLocalizations: Record<string, string> = {};
  for (const locale of keys.slice(1)) {
    descriptionLocalizations[locale as string] = locales[locale].description;
  }

  return new SlashCommandBuilder()
    .setName(defaultStrings.name)
    .setDescription(defaultStrings.description)
    .setDescriptionLocalizations(descriptionLocalizations);
}
