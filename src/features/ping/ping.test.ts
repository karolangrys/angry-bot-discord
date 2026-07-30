import { expect, test, describe, mock } from 'bun:test';
import { execute, data } from './ping.command';
import { ChatInputCommandInteraction, Message } from 'discord.js';

// Mock getT to return the key and vars stringified for easy testing
mock.module('../../core/i18n', () => ({
  getT: async () => (key: string, vars: any) => `${key} ${JSON.stringify(vars)}`,
}));

describe('Ping Command', () => {
  test('has correct data', () => {
    expect(data.name).toBe('ping');
    expect(data.description).toBeDefined();
  });

  test('replies with latency', async () => {
    const editReplyMock = mock(async () => {});
    
    // Mocking interaction
    const interaction = {
      createdTimestamp: 1000,
      reply: mock(async () => {
        return { createdTimestamp: 1050 } as Message;
      }),
      editReply: editReplyMock,
    } as unknown as ChatInputCommandInteraction;

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalled();
    expect(editReplyMock).toHaveBeenCalledWith('response {"latency":50}');
  });
});
