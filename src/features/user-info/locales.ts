import type { LocaleBundle } from '../../core/i18n-config';

/** i18next namespace for this feature. */
export const NAMESPACE = 'user-info';

type UserInfoStrings = {
  /** Slash command metadata, read directly by SlashCommandBuilder rather than through i18next. */
  name: string;
  description: string;
  target: {
    name: string;
    description: string;
  };
  /** Runtime strings. */
  response: string;
};

const locales = {
  'en-US': {
    name: 'user-info',
    description: 'Displays information about a user.',
    target: {
      name: 'target',
      description: 'The user you want to get information about (leave empty for yourself)',
    },
    response:
      '**User:** {{name}} ({{username}})\n**ID:** {{id}}\n**Joined Discord:** {{createdAt}}',
  },
  pl: {
    name: 'user-info',
    description: 'Wyświetla informacje o użytkowniku.',
    target: {
      name: 'cel',
      description: 'Użytkownik, którego informacje chcesz zobaczyć (zostaw puste dla siebie)',
    },
    response:
      '**Użytkownik:** {{name}} ({{username}})\n**ID:** {{id}}\n**Dołączył do Discorda:** {{createdAt}}',
  },
} satisfies LocaleBundle<UserInfoStrings>;

export default locales;
