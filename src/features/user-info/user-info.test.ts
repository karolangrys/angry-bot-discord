import { expect, test, describe, mock } from 'bun:test';
import { execute, data } from './user-info.command';
import { ChatInputCommandInteraction, User } from 'discord.js';

mock.module('../../core/i18n', () => ({
  getT: async () => (key: string, vars: any) => `${key} ${JSON.stringify(vars || {})}`,
}));

describe('User Info Command', () => {
  test('has correct data', () => {
    expect(data.name).toBe('user-info');
  });

  test('replies with user info', async () => {
    const replyMock = mock(async () => {});

    const targetUser = {
      tag: 'TestUser#1234',
      id: '987654321',
      createdAt: new Date('2023-01-01'),
    } as User;

    const interaction = {
      options: {
        getUser: () => targetUser,
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await execute(interaction);

    expect(replyMock).toHaveBeenCalled();
  });
});
