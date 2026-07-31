import { describe, expect, test } from 'bun:test';
import { MessageFlags } from 'discord.js';
import { contentOf, createInteraction, flagsOf } from '../../test-support';
import { data, execute } from './server-info.command';

const guild = {
  name: 'Test Server',
  memberCount: 42,
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
  ownerId: '123456789',
};

describe('/server-info', () => {
  test('exposes localized command metadata and is guild-only', () => {
    expect(data.name).toBe('server-info');
    // InteractionContextType.Guild === 0
    expect(data.toJSON().contexts).toEqual([0]);
  });

  test('renders every field of the response', async () => {
    const { interaction, reply } = createInteraction({ guild });

    await execute(interaction);

    const message = contentOf(reply.mock.calls[0]?.[0]);
    expect(message).toContain('Test Server');
    expect(message).toContain('42');
    // A Discord timestamp, so each viewer sees their own locale and timezone.
    expect(message).toContain(`<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>`);
    expect(message).toContain('<@123456789>');
    expect(message).not.toContain('response');
  });

  test('translates the response', async () => {
    const { interaction, reply } = createInteraction({ guild, locale: 'pl' });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Liczba członków');
  });

  test('replies ephemerally when there is no guild', async () => {
    const { interaction, reply } = createInteraction({ guild: null });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('only be used on a server');
    expect(flagsOf(reply.mock.calls[0]?.[0])).toBe(MessageFlags.Ephemeral);
  });
});
