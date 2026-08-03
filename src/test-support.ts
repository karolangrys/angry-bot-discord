import { mock } from 'bun:test';
import type { ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';

/** User ID treated as the bot owner in tests; `test-setup.ts` publishes it via OWNER_IDS. */
export const TEST_OWNER_ID = '100000000000000001';

/** Any other ID, used to assert that non-owners are rejected. */
export const TEST_MEMBER_ID = '200000000000000002';

type ReplyPayload = string | { content?: string; flags?: number };

type OptionValues = {
  subcommand?: string;
  group?: string | null;
  strings?: Record<string, string>;
  channelId?: string;
};

/**
 * Stands in for `interaction.options`. Only the accessors the commands actually call are provided;
 * `getSubcommandGroup` returns null by default, matching a command invoked without a group.
 */
export function createOptions(values: OptionValues = {}) {
  return {
    getSubcommand: () => values.subcommand ?? '',
    getSubcommandGroup: () => values.group ?? null,
    getString: (name: string) => values.strings?.[name] ?? null,
    getChannel: () => (values.channelId ? { id: values.channelId } : null),
  };
}

/**
 * Builds a fake interaction with recording mocks. Only the members the commands actually touch are
 * populated; `overrides` fills in whatever a specific test needs.
 */
export function createInteraction(overrides: Record<string, unknown> = {}) {
  const reply = mock(async (_payload: ReplyPayload) => {});
  const editReply = mock(async (_payload: ReplyPayload) => {});
  const followUp = mock(async (_payload: ReplyPayload) => {});
  const deferReply = mock(async () => {});
  const setActivity = mock((_options: unknown) => {});
  const showModal = mock(async (_modal: unknown) => {});

  const base = {
    locale: 'en-US',
    guildId: null,
    channelId: 'TEST_CHANNEL_ID',
    createdTimestamp: Date.now(),
    user: {
      id: TEST_MEMBER_ID,
      username: 'tester',
      displayName: 'Tester',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    },
    client: {
      ws: { ping: 42 },
      user: { tag: 'bot#0', setActivity },
    },
    inGuild: () => false,
    options: createOptions(),
    reply,
    editReply,
    followUp,
    deferReply,
    showModal,
  };

  return {
    interaction: { ...base, ...overrides } as unknown as ChatInputCommandInteraction,
    reply,
    editReply,
    followUp,
    deferReply,
    setActivity,
    showModal,
  };
}

/**
 * Fake modal submission. Shares the reply mocks with `createInteraction`, because the code under
 * test treats both interaction kinds the same way (see the `RepliableInteraction` widening).
 */
export function createModalInteraction(
  customId: string,
  fields: Record<string, string>,
  overrides: Record<string, unknown> = {},
) {
  const reply = mock(async (_payload: ReplyPayload) => {});
  const editReply = mock(async (_payload: ReplyPayload) => {});
  const deferReply = mock(async (_options?: unknown) => {});

  const base = {
    customId,
    locale: 'en-US',
    guildId: null,
    channelId: 'TEST_CHANNEL_ID',
    user: { id: TEST_OWNER_ID, username: 'owner' },
    client: { ws: { ping: 42 }, channels: { fetch: async () => null } },
    fields: { getTextInputValue: (id: string) => fields[id] ?? '' },
    replied: false,
    deferred: false,
    reply,
    editReply,
    deferReply,
  };

  return {
    interaction: { ...base, ...overrides } as unknown as ModalSubmitInteraction,
    reply,
    editReply,
    deferReply,
  };
}

/** Extracts the message text from either payload shape accepted by discord.js. */
export function contentOf(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload && typeof payload === 'object' && 'content' in payload) {
    return String((payload as { content: unknown }).content);
  }
  return '';
}

export function flagsOf(payload: unknown): number | undefined {
  if (payload && typeof payload === 'object' && 'flags' in payload) {
    const flags = (payload as { flags: unknown }).flags;
    return typeof flags === 'number' ? flags : undefined;
  }
  return undefined;
}
