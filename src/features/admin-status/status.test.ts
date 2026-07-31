import { describe, expect, test } from 'bun:test';
import { MessageFlags } from 'discord.js';
import {
  contentOf,
  createInteraction,
  flagsOf,
  TEST_MEMBER_ID,
  TEST_OWNER_ID,
} from '../../test-support';
import { restoreActivity } from './activity';
import { data, execute, onReady } from './status.command';

function ownerInteraction(overrides: Record<string, unknown> = {}) {
  return createInteraction({
    user: { id: TEST_OWNER_ID, username: 'owner', displayName: 'Owner' },
    options: { getString: () => 'Testowy status' },
    ...overrides,
  });
}

describe('/status', () => {
  test('exposes localized command metadata and is hidden from members', () => {
    expect(data.name).toBe('status');
    const json = data.toJSON();
    expect(json.default_member_permissions).toBe('0');
    expect(json.options?.[0]?.name).toBe('description');
  });

  test('rejects a non-owner even with guild permissions', async () => {
    const { interaction, reply, setActivity } = createInteraction({
      user: { id: TEST_MEMBER_ID },
      // Deliberately "allowed" at guild level: the presence is process-wide, so this must not matter.
      memberPermissions: { has: () => true },
      options: { getString: () => 'Nope' },
    });

    await execute(interaction);

    expect(setActivity).not.toHaveBeenCalled();
    const message = contentOf(reply.mock.calls[0]?.[0]);
    expect(message).toContain('Only the bot owner');
    expect(flagsOf(reply.mock.calls[0]?.[0])).toBe(MessageFlags.Ephemeral);
  });

  test('sets the presence for the owner', async () => {
    const { interaction, reply, setActivity } = ownerInteraction();

    await execute(interaction);

    expect(setActivity).toHaveBeenCalled();
    const activity = setActivity.mock.calls[0]?.[0] as {
      name: string;
      state: string;
      type: number;
    };
    // ActivityType.Custom renders `state`; a name-only payload displays nothing.
    expect(activity.state).toBe('Testowy status');
    expect(activity.name).toBe('Testowy status');

    const message = contentOf(reply.mock.calls[0]?.[0]);
    expect(message).toContain('Testowy status');
    expect(message).not.toContain('success');
  });

  test('answers the owner in their client language', async () => {
    const { interaction, reply } = ownerInteraction({ locale: 'pl' });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Pomyślnie zmieniono status');
  });

  test('persists the status and restores it on the next ready', async () => {
    const { interaction } = ownerInteraction({
      options: { getString: () => 'Zapisany status' },
    });
    await execute(interaction);

    // A fresh client, as after a restart.
    const { interaction: next, setActivity } = createInteraction();
    await restoreActivity(next.client as never);

    expect(setActivity).toHaveBeenCalled();
    const activity = setActivity.mock.calls[0]?.[0] as { state: string };
    expect(activity.state).toBe('Zapisany status');
  });

  test('exposes the restore hook so core can run it after login', () => {
    expect(onReady).toBe(restoreActivity);
  });
});
