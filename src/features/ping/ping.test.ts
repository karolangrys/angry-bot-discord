import { describe, expect, test } from 'bun:test';
import { contentOf, createInteraction } from '../../test-support';
import { data, execute } from './ping.command';

describe('/ping', () => {
  test('exposes localized command metadata', () => {
    expect(data.name).toBe('ping');
    expect(data.description).toBeTruthy();
    expect(data.toJSON().description_localizations?.pl).toBeTruthy();
  });

  test('reports round-trip and gateway latency', async () => {
    const { interaction, deferReply, editReply } = createInteraction({
      createdTimestamp: Date.now() - 40,
      client: { ws: { ping: 25 } },
    });

    await execute(interaction);

    expect(deferReply).toHaveBeenCalled();
    const message = contentOf(editReply.mock.calls[0]?.[0]);

    expect(message).toContain('Pong!');
    expect(message).toContain('25ms');
    // A raw key here would mean the i18next namespace is not wired up.
    expect(message).not.toContain('response');
  });

  test('answers in the client language', async () => {
    const { interaction, editReply } = createInteraction({ locale: 'pl' });

    await execute(interaction);

    expect(contentOf(editReply.mock.calls[0]?.[0])).toContain('Czas odpowiedzi');
  });

  test('never reports a negative gateway latency', async () => {
    // discord.js returns -1 before the first heartbeat is acknowledged.
    const { interaction, editReply } = createInteraction({ client: { ws: { ping: -1 } } });

    await execute(interaction);

    expect(contentOf(editReply.mock.calls[0]?.[0])).toContain('0ms');
  });
});
