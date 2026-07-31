import type { LocaleBundle } from './i18n-config';

/** i18next namespace holding strings owned by the framework rather than by a feature. */
export const NAMESPACE = 'core';

type CoreStrings = {
  command_error: string;
  command_unknown: string;
};

const locales = {
  'en-US': {
    command_error: 'An error occurred while running this command.',
    command_unknown: 'This command is no longer available. Please try again later.',
  },
  pl: {
    command_error: 'Wystąpił błąd podczas wykonywania tej komendy!',
    command_unknown: 'Ta komenda nie jest już dostępna. Spróbuj ponownie później.',
  },
} satisfies LocaleBundle<CoreStrings>;

export default locales;
