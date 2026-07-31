import type { LocaleBundle } from '../../core/i18n-config';

/** i18next namespace for this feature. */
export const NAMESPACE = 'server-info';

type ServerInfoStrings = {
  /** Slash command metadata, read directly by SlashCommandBuilder rather than through i18next. */
  name: string;
  description: string;
  /** Runtime strings. */
  not_in_guild: string;
  response: string;
};

const locales = {
  'en-US': {
    name: 'server-info',
    description: 'Displays information about the server.',
    not_in_guild: 'This command can only be used on a server.',
    response:
      '**Server:** {{name}}\n**Members:** {{memberCount}}\n**Created:** {{createdAt}}\n**Owner:** {{owner}}',
  },
  pl: {
    name: 'server-info',
    description: 'Wyświetla informacje o serwerze.',
    not_in_guild: 'Ta komenda może być użyta tylko na serwerze.',
    response:
      '**Serwer:** {{name}}\n**Liczba członków:** {{memberCount}}\n**Stworzony:** {{createdAt}}\n**Właściciel:** {{owner}}',
  },
} satisfies LocaleBundle<ServerInfoStrings>;

export default locales;
