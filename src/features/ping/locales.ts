import type { LocaleBundle } from '../../core/i18n-config';

/**
 * i18next namespace for this feature. Commands must resolve their translations through this
 * constant so that renaming the folder cannot silently break the lookup.
 */
export const NAMESPACE = 'ping';

type PingStrings = {
  /** Slash command metadata, read directly by SlashCommandBuilder rather than through i18next. */
  name: string;
  description: string;
  /** Runtime strings. */
  response: string;
};

const locales = {
  'en-US': {
    name: 'ping',
    description: 'Replies with Pong and latency.',
    response: 'Pong! Round-trip: {{latency}}ms · Gateway: {{gateway}}ms.',
  },
  pl: {
    name: 'ping',
    description: 'Odpowiada Pong! oraz podaje opóźnienie bota.',
    response: 'Pong! Czas odpowiedzi: {{latency}}ms · Gateway: {{gateway}}ms.',
  },
} satisfies LocaleBundle<PingStrings>;

export default locales;
