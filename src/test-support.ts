import { mock } from 'bun:test';
import type { ChatInputCommandInteraction } from 'discord.js';

/** User ID treated as the bot owner in tests; `test-setup.ts` publishes it via OWNER_IDS. */
export const TEST_OWNER_ID = '100000000000000001';

/** Any other ID, used to assert that non-owners are rejected. */
export const TEST_MEMBER_ID = '200000000000000002';

type ReplyPayload = string | { content?: string; flags?: number };

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

  const base = {
    locale: 'en-US',
    guildId: null,
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
    reply,
    editReply,
    followUp,
    deferReply,
  };

  return {
    interaction: { ...base, ...overrides } as unknown as ChatInputCommandInteraction,
    reply,
    editReply,
    followUp,
    deferReply,
    setActivity,
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
