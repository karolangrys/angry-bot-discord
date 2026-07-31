import type { LocaleBundle } from '../../core/i18n-config';

/**
 * i18next namespace for this feature.
 *
 * This used to be derived from the folder name (`admin-status`) while the command asked for
 * `status`, so every message rendered as a raw translation key.
 */
export const NAMESPACE = 'admin-status';

type StatusStrings = {
  /** Slash command metadata, read directly by SlashCommandBuilder rather than through i18next. */
  name: string;
  description: string;
  status_text: {
    name: string;
    description: string;
  };
  /** Runtime strings. */
  no_permission: string;
  success: string;
  error: string;
};

const locales = {
  'en-US': {
    name: 'status',
    description: 'Changes the bot status (bot owner only).',
    status_text: {
      name: 'description',
      description: 'The status text to display',
    },
    no_permission: 'Only the bot owner can change the bot status.',
    success: 'Successfully changed the bot status to: **{{status}}**',
    error: 'An error occurred while changing the status.',
  },
  pl: {
    name: 'status',
    description: 'Zmienia status bota (tylko właściciel bota).',
    status_text: {
      name: 'opis',
      description: 'Tekst statusu do wyświetlenia',
    },
    no_permission: 'Tylko właściciel bota może zmienić jego status.',
    success: 'Pomyślnie zmieniono status bota na: **{{status}}**',
    error: 'Wystąpił błąd podczas zmiany statusu.',
  },
} satisfies LocaleBundle<StatusStrings>;

export default locales;
