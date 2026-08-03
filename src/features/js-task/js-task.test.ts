import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/db-client';
import { scheduledScripts, scriptStore } from '../../core/db/schema';
import {
  contentOf,
  createInteraction,
  createModalInteraction,
  createOptions,
  TEST_MEMBER_ID,
  TEST_OWNER_ID,
} from '../../test-support';
import { execute, handleModal } from './js-task.command';
import { stopAllJobs } from './scheduler';
import { SECRET_PREFIX } from './tasks';

/** These paths spawn a real sandbox process, so they need more than the 5s default. */
const SANDBOX_TIMEOUT = 25_000;

const ownerInteraction = (options: Parameters<typeof createOptions>[0]) =>
  createInteraction({
    user: { id: TEST_OWNER_ID, username: 'owner' },
    options: createOptions(options),
  });

const row = (name: string) =>
  db.select().from(scheduledScripts).where(eq(scheduledScripts.name, name)).get();

beforeEach(async () => {
  await db.delete(scheduledScripts);
});

afterEach(() => {
  stopAllJobs();
});

describe('permissions', () => {
  test('refuses anyone who is not the bot owner', async () => {
    const { interaction, reply } = createInteraction({
      user: { id: TEST_MEMBER_ID, username: 'nosy' },
      options: createOptions({ subcommand: 'list' }),
    });

    await execute(interaction);

    // Asserting on translated text, not just that reply happened.
    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Only the bot owner');
  });

  test('re-checks ownership on modal submit, since a customId proves nothing', async () => {
    const { interaction, reply } = createModalInteraction(
      'js-task:add:CHANNEL',
      { name: 'sneaky', cron: '*/5 * * * *', code: 'return 1' },
      { user: { id: TEST_MEMBER_ID, username: 'nosy' } },
    );

    await handleModal(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Only the bot owner');
    expect(await row('sneaky')).toBeUndefined();
  });
});

describe('add', () => {
  test('opens a modal rather than replying', async () => {
    const { interaction, showModal, reply } = ownerInteraction({ subcommand: 'add' });

    await execute(interaction);

    expect(showModal).toHaveBeenCalledTimes(1);
    // A modal IS the response; replying first would make showModal fail.
    expect(reply).not.toHaveBeenCalled();
  });
});

describe('saving a task', () => {
  test(
    'stores it enabled and reports the dry run when the code works',
    async () => {
      const { interaction, editReply } = createModalInteraction('js-task:add:CHANNEL_1', {
        name: 'works',
        cron: '*/5 * * * *',
        code: 'console.log("ran"); return "hello"',
      });

      await handleModal(interaction);

      const stored = await row('works');
      expect(stored?.enabled).toBe(true);
      expect(stored?.channelId).toBe('CHANNEL_1');
      expect(stored?.createdBy).toBe(TEST_OWNER_ID);

      const message = contentOf(editReply.mock.calls[0]?.[0]);
      expect(message).toContain('works');
      // The preview shows what would be posted, plus the captured log line.
      expect(message).toContain('hello');
      expect(message).toContain('ran');
    },
    SANDBOX_TIMEOUT,
  );

  test(
    'keeps the code but disables the task when the dry run throws',
    async () => {
      const { interaction, editReply } = createModalInteraction('js-task:add:CHANNEL_1', {
        name: 'throws',
        cron: '*/5 * * * *',
        code: 'throw new Error("boom")',
      });

      await handleModal(interaction);

      // The whole point: a modal cannot be reopened, so the code must survive a failed run.
      const stored = await row('throws');
      expect(stored).toBeDefined();
      expect(stored?.code).toBe('throw new Error("boom")');
      expect(stored?.enabled).toBe(false);

      const message = contentOf(editReply.mock.calls[0]?.[0]);
      expect(message).toContain('boom');
      expect(message).toContain('disabled');
    },
    SANDBOX_TIMEOUT,
  );

  test('keeps the code but disables the task when the syntax is broken', async () => {
    const { interaction, editReply } = createModalInteraction('js-task:add:CHANNEL_1', {
      name: 'unparseable',
      cron: '*/5 * * * *',
      code: 'return 1 +',
    });

    await handleModal(interaction);

    const stored = await row('unparseable');
    expect(stored?.code).toBe('return 1 +');
    expect(stored?.enabled).toBe(false);
    expect(contentOf(editReply.mock.calls[0]?.[0])).toContain('does not parse');
  });

  test('keeps the code but disables the task when the cron is unusable', async () => {
    const { interaction, editReply } = createModalInteraction('js-task:add:CHANNEL_1', {
      name: 'badcron',
      cron: 'every tuesday maybe',
      code: 'return 1',
    });

    await handleModal(interaction);

    const stored = await row('badcron');
    expect(stored?.enabled).toBe(false);
    expect(contentOf(editReply.mock.calls[0]?.[0])).toContain('cron');
  });

  test('rejects a sub-minute schedule with a distinct message', async () => {
    const { interaction, editReply } = createModalInteraction('js-task:add:CHANNEL_1', {
      name: 'toofast',
      cron: '* * * * * *',
      code: 'return 1',
    });

    await handleModal(interaction);

    expect((await row('toofast'))?.enabled).toBe(false);
    expect(contentOf(editReply.mock.calls[0]?.[0])).toContain('once a minute');
  });

  test('refuses an invalid name — the only path that cannot preserve the code', async () => {
    const { interaction, editReply } = createModalInteraction('js-task:add:CHANNEL_1', {
      name: 'Not A Valid Name',
      cron: '*/5 * * * *',
      code: 'return 1',
    });

    await handleModal(interaction);

    expect(contentOf(editReply.mock.calls[0]?.[0])).toContain('Invalid name');
    expect(await db.select().from(scheduledScripts).all()).toHaveLength(0);
  });
});

describe('test scratchpad', () => {
  test(
    'runs the code without persisting anything',
    async () => {
      const { interaction, editReply } = createModalInteraction('js-task:test', {
        code: 'await store.set("k", "v"); return await store.get("k")',
      });

      await handleModal(interaction);

      expect(contentOf(editReply.mock.calls[0]?.[0])).toContain('v');
      expect(await db.select().from(scheduledScripts).all()).toHaveLength(0);
      expect(await db.select().from(scriptStore).all()).toHaveLength(0);
    },
    SANDBOX_TIMEOUT,
  );
});

describe('lifecycle', () => {
  const seed = async (overrides: Partial<typeof scheduledScripts.$inferInsert> = {}) => {
    await db.insert(scheduledScripts).values({
      name: 'seeded',
      cron: '*/5 * * * *',
      code: 'return "x"',
      channelId: 'CHANNEL_1',
      enabled: true,
      createdBy: TEST_OWNER_ID,
      createdAt: new Date(),
      ...overrides,
    });
  };

  test('lists stored tasks', async () => {
    await seed();
    const { interaction, reply } = ownerInteraction({ subcommand: 'list' });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('seeded');
  });

  test('says so when there is nothing to list', async () => {
    const { interaction, reply } = ownerInteraction({ subcommand: 'list' });
    await execute(interaction);
    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('No tasks yet');
  });

  test('shows the code of a task', async () => {
    await seed();
    const { interaction, reply } = ownerInteraction({
      subcommand: 'show',
      strings: { name: 'seeded' },
    });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('return "x"');
  });

  test('reports a missing task by name', async () => {
    const { interaction, reply } = ownerInteraction({
      subcommand: 'show',
      strings: { name: 'ghost' },
    });

    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('ghost');
  });

  test('deletes a task together with its stored state', async () => {
    await seed();
    await db.insert(scriptStore).values({ scriptName: 'seeded', key: 'n', value: '1' });

    const { interaction } = ownerInteraction({ subcommand: 'remove', strings: { name: 'seeded' } });
    await execute(interaction);

    expect(await row('seeded')).toBeUndefined();
    // Cascade, not application code — see the foreign key in the schema.
    expect(await db.select().from(scriptStore).all()).toHaveLength(0);
  });

  test('refuses to enable a task whose cron is unusable', async () => {
    await seed({ name: 'broken', cron: 'nonsense', enabled: false });

    const { interaction, reply } = ownerInteraction({
      subcommand: 'toggle',
      strings: { name: 'broken' },
    });
    await execute(interaction);

    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Cannot enable');
    expect((await row('broken'))?.enabled).toBe(false);
  });

  test('disables an enabled task', async () => {
    await seed();
    const { interaction, reply } = ownerInteraction({
      subcommand: 'toggle',
      strings: { name: 'seeded' },
    });

    await execute(interaction);

    expect((await row('seeded'))?.enabled).toBe(false);
    expect(contentOf(reply.mock.calls[0]?.[0])).toContain('Disabled');
  });
});

describe('secrets', () => {
  beforeEach(async () => {
    await db.insert(scheduledScripts).values({
      name: 'withsecret',
      cron: '*/5 * * * *',
      code: 'return 1',
      channelId: 'CHANNEL_1',
      enabled: true,
      createdBy: TEST_OWNER_ID,
      createdAt: new Date(),
    });
  });

  test('stores a secret under a prefix and never echoes the value', async () => {
    const { interaction, reply } = ownerInteraction({
      group: 'secret',
      subcommand: 'set',
      strings: { name: 'withsecret', key: 'api-key', value: 'super-secret-value' },
    });

    await execute(interaction);

    const stored = await db.select().from(scriptStore).all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.key).toBe(`${SECRET_PREFIX}api-key`);
    expect(stored[0]?.value).toBe('super-secret-value');

    const message = contentOf(reply.mock.calls[0]?.[0]);
    expect(message).toContain('api-key');
    expect(message).not.toContain('super-secret-value');
  });

  test('lists names only', async () => {
    await db
      .insert(scriptStore)
      .values({ scriptName: 'withsecret', key: `${SECRET_PREFIX}token`, value: 'do-not-show' });

    const { interaction, reply } = ownerInteraction({
      group: 'secret',
      subcommand: 'list',
      strings: { name: 'withsecret' },
    });
    await execute(interaction);

    const message = contentOf(reply.mock.calls[0]?.[0]);
    expect(message).toContain('token');
    expect(message).not.toContain('do-not-show');
  });

  test('removes a secret', async () => {
    await db
      .insert(scriptStore)
      .values({ scriptName: 'withsecret', key: `${SECRET_PREFIX}token`, value: 'x' });

    const { interaction } = ownerInteraction({
      group: 'secret',
      subcommand: 'unset',
      strings: { name: 'withsecret', key: 'token' },
    });
    await execute(interaction);

    expect(await db.select().from(scriptStore).all()).toHaveLength(0);
  });
});
