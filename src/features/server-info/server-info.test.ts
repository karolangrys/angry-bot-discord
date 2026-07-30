import { expect, test, describe, mock } from 'bun:test';
import { execute, data } from './server-info.command';
import { ChatInputCommandInteraction } from 'discord.js';

mock.module('../../core/i18n', () => ({
  getT: async () => (key: string, vars: any) => `${key} ${JSON.stringify(vars || {})}`,
}));

describe('Server Info Command', () => {
  test('has correct data', () => {
    expect(data.name).toBe('server-info');
  });

  test('replies with server info if in a guild', async () => {
    const replyMock = mock(async () => {});
    
    const interaction = {
      guild: {
        name: 'Test Server',
        memberCount: 42,
        createdAt: new Date('2023-01-01'),
        ownerId: '123456789',
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await execute(interaction);

    expect(replyMock).toHaveBeenCalled();
    // Verification logic depends on what getT mock returns
  });

  test('replies with error if not in a guild', async () => {
    const replyMock = mock(async () => {});
    
    const interaction = {
      guild: null,
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await execute(interaction);

    expect(replyMock).toHaveBeenCalledWith({ content: 'not_in_guild {}', ephemeral: true });
  });
});
