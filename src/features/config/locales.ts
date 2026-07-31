import { SUPPORTED_LOCALES, type LocaleBundle, type SupportedLocale } from '../../core/i18n-config';

/** i18next namespace for this feature. */
export const NAMESPACE = 'config';

type ConfigStrings = {
  /** Slash command metadata, read directly by SlashCommandBuilder rather than through i18next. */
  name: string;
  description: string;
  language: {
    name: string;
    description: string;
    lang_option: string;
    lang_desc: string;
  };
  /** Runtime strings. */
  guild_only: string;
  no_permission: string;
  success: string;
  error: string;
};

const locales = {
  'en-US': {
    name: 'config',
    description: 'Server configuration commands.',
    language: {
      name: 'language',
      description: 'Change the bot language on this server.',
      lang_option: 'language',
      lang_desc: 'Select the language',
    },
    guild_only: 'This command can only be used on a server.',
    no_permission: 'You do not have permission to change server configuration.',
    success: 'Language has been successfully changed to: {{lang}}.',
    error: 'An error occurred while saving the configuration.',
  },
  pl: {
    name: 'config',
    description: 'Komendy konfiguracyjne serwera.',
    language: {
      name: 'jezyk',
      description: 'Zmienia język bota na tym serwerze.',
      lang_option: 'wybor',
      lang_desc: 'Wybierz język',
    },
    guild_only: 'Ta komenda może być użyta tylko na serwerze.',
    no_permission: 'Nie masz uprawnień do zmiany konfiguracji serwera.',
    success: 'Pomyślnie zmieniono język bota na: {{lang}}.',
    error: 'Wystąpił błąd podczas zapisywania konfiguracji.',
  },
} satisfies LocaleBundle<ConfigStrings>;

/**
 * Native display names, one per supported locale. Typed as a total record so that adding a locale
 * to SUPPORTED_LOCALES without a label here is a compile error rather than a missing choice.
 */
const LANGUAGE_LABELS: Record<SupportedLocale, string> = {
  'en-US': 'English (US)',
  pl: 'Polski',
};

export const LANGUAGE_CHOICES = SUPPORTED_LOCALES.map((value) => ({
  name: LANGUAGE_LABELS[value],
  value,
}));

export default locales;
