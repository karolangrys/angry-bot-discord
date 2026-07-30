import { expect, test, describe, mock } from 'bun:test';
import { execute, data } from './status.command';
import { ChatInputCommandInteraction } from 'discord.js';

mock.module('../../core/i18n', () => ({
  getT: async () => (key: string, vars: any) => `${key} ${JSON.stringify(vars || {})}`,
}));

describe('Status Command', () => {
  test('has correct data', () => {
    expect(data.name).toBe('status');
  });

  test('replies with error if no permission', async () => {
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

  test('changes status if has permission', async () => {
    const replyMock = mock(async () => {});
    const setActivityMock = mock();
    
    const interaction = {
      memberPermissions: {
        has: () => true,
      },
      options: {
        getString: () => 'Nowy status',
      },
      client: {
        user: {
          setActivity: setActivityMock,
        }
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await execute(interaction);

    expect(setActivityMock).toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith({ content: 'success {"opis":"Nowy status"}', ephemeral: true });
  });
});
