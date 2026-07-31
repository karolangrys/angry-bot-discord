import { describe, expect, test } from 'bun:test';
import { MessageFlags } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/db-client';
import { guildConfigs } from '../../core/db/schema';
import { clearGuildLanguageCache } from '../../core/i18n';
import { contentOf, createInteraction, flagsOf } from '../../test-support';
import { data, execute } from './config.command';

function guildInteraction(guildId: string, overrides: Record<string, unknown> = {}) {
  return createInteraction({
    guildId,
    inGuild: () => true,
    memberPermissions: { has: () => true },
    options: {
      getSubcommand: () => 'language',
      getString: () => 'pl',
    },
    ...overrides,
  });
}

describe('/config', () => {
  test('is guild-only and hidden from members', () => {
    expect(data.name).toBe('config');
    const json = data.toJSON();
    expect(json.default_member_permissions).toBe('0');
    // InteractionContextType.Guild === 0
    expect(json.contexts).toEqual([0]);
  });

  test('builds the language choices from SUPPORTED_LOCALES', () => {
    const subcommand = data.toJSON().options?.[0] as
      { options?: { choices?: { value: string }[] }[] } | undefined;
    const choices = subcommand?.options?.[0]?.choices ?? [];
    expect(choices.map((choice) => choice.value).sort()).toEqual(['en-US', 'pl']);
  });

  test('refuses to run outside a guild', async () => {
    const { interaction, reply } = createInteraction({ inGuild: () => false });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('only be used on a server');
    expect(flagsOf(reply.mock.calls[0]?.[0])).toBe(MessageFlags.Ephemeral);
  });

  test('refuses a member without ManageGuild', async () => {
    const { interaction, reply } = guildInteraction('guild-config-denied', {
      memberPermissions: { has: () => false },
    });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('do not have permission');
  });

  test('rejects an unknown subcommand instead of falling through', async () => {
    const { interaction, reply } = guildInteraction('guild-config-unknown', {
      options: { getSubcommand: () => 'something-new', getString: () => 'pl' },
    });

    await execute(interaction);

    const stored = await db
      .select()
      .from(guildConfigs)
      .where(eq(guildConfigs.guildId, 'guild-config-unknown'))
      .get();

    expect(stored).toBeUndefined();
    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('error occurred');
  });

  test('rejects a language outside SUPPORTED_LOCALES', async () => {
    const { interaction, reply } = guildInteraction('guild-config-bad-lang', {
      options: { getSubcommand: () => 'language', getString: () => 'klingon' },
    });

    await execute(interaction);

    const stored = await db
      .select()
      .from(guildConfigs)
      .where(eq(guildConfigs.guildId, 'guild-config-bad-lang'))
      .get();

    expect(stored).toBeUndefined();
    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('error occurred');
  });

  test('stores the language and confirms in the new language', async () => {
    const guildId = 'guild-config-ok';
    clearGuildLanguageCache();

    const { interaction, reply } = guildInteraction(guildId);
    await execute(interaction);

    const stored = await db
      .select()
      .from(guildConfigs)
      .where(eq(guildConfigs.guildId, guildId))
      .get();
    expect(stored?.language).toBe('pl');

    // The confirmation must already use the freshly selected language, which only works if the
    // guild language cache was invalidated after the write.
    const message = contentOf(reply.mock.calls[0]?.[0]);
    expect(message).toContain('Pomyślnie zmieniono język');
    expect(message).not.toContain('success');
  });

  test('updates an existing row instead of failing on the primary key', async () => {
    const guildId = 'guild-config-upsert';
    await db.insert(guildConfigs).values({ guildId, language: 'en-US' });

    const { interaction, reply } = guildInteraction(guildId);
    await execute(interaction);

    const stored = await db
      .select()
      .from(guildConfigs)
      .where(eq(guildConfigs.guildId, guildId))
      .get();

    expect(stored?.language).toBe('pl');
    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Pomyślnie zmieniono język');
  });
});
