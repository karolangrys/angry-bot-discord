import { describe, expect, test } from 'bun:test';
import { contentOf, createInteraction } from '../../test-support';
import { data, execute } from './user-info.command';

const targetUser = {
  id: '987654321',
  username: 'testuser',
  displayName: 'Test User',
  createdAt: new Date('2023-01-01T00:00:00.000Z'),
};

describe('/user-info', () => {
  test('exposes localized command metadata with an optional target', () => {
    expect(data.name).toBe('user-info');
    const option = data.toJSON().options?.[0];
    expect(option?.name).toBe('target');
    expect(option?.required).toBeFalsy();
  });

  test('renders the requested user', async () => {
    const { interaction, reply } = createInteraction({
      options: { getUser: () => targetUser },
    });

    await execute(interaction);

    const message = contentOf(reply.mock.calls[0]?.[0]);
    expect(message).toContain('Test User');
    expect(message).toContain('testuser');
    expect(message).toContain('987654321');
    expect(message).toContain(`<t:${Math.floor(targetUser.createdAt.getTime() / 1000)}:D>`);
    expect(message).not.toContain('response');
  });

  test('falls back to the caller when no target is given', async () => {
    const { interaction, reply } = createInteraction({
      options: { getUser: () => null },
    });

    await execute(interaction);

    const message = contentOf(reply.mock.calls[0]?.[0]);
    // `createInteraction` defaults to the "Tester" user.
    expect(message).toContain('Tester');
    expect(message).toContain('tester');
  });

  test('translates the response', async () => {
    const { interaction, reply } = createInteraction({
      locale: 'pl',
      options: { getUser: () => targetUser },
    });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Dołączył do Discorda');
  });
});
