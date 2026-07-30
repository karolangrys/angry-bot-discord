import { expect, test, describe, mock } from 'bun:test';
import { execute, data } from './config.command';
import { ChatInputCommandInteraction } from 'discord.js';

mock.module('../../core/i18n', () => ({
  getT: async () => (key: string, vars: any) => `${key} ${JSON.stringify(vars || {})}`,
  SUPPORTED_LOCALES: ['en-US', 'pl'],
}));

mock.module('../../core/db/db-client', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: mock(async () => {}),
      }),
    }),
  },
}));

describe('Config Command', () => {
  test('has correct data', () => {
    expect(data.name).toBe('config');
  });

  test('fails if no permission', async () => {
    const replyMock = mock(async () => {});
    
    const interaction = {
      memberPermissions: {
        has: () => false,
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await execute(interaction);

    expect(replyMock).toHaveBeenCalledWith({ content: 'no_permission {}', ephemeral: true });
  });

  test('changes language', async () => {
    const replyMock = mock(async () => {});
    
    const interaction = {
      guildId: '12345',
      memberPermissions: {
        has: () => true,
      },
      options: {
        getString: () => 'pl',
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await execute(interaction);

    expect(replyMock).toHaveBeenCalledWith({ content: 'success {"lang":"pl"}', ephemeral: true });
  });
});
