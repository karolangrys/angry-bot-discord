import { describe, expect, test } from 'bun:test';
import {
  activeSandboxCount,
  normalizeMessage,
  runInSandbox,
  validateSyntax,
  type ScriptStore,
} from './sandbox';

/** Spawning a real subprocess costs a few hundred ms, so these need more than the 5s default. */
const SPAWN_TIMEOUT = 20_000;

function memoryStore(initial: Record<string, string> = {}): ScriptStore & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
  };
}

const run = (code: string, options: Partial<Parameters<typeof runInSandbox>[1]> = {}) =>
  runInSandbox(code, { store: memoryStore(), trigger: 'test', ...options });

describe('validateSyntax', () => {
  test('accepts a valid script', () => {
    expect(validateSyntax('const x = 1; return x')).toEqual({ ok: true });
  });

  test('rejects a syntax error without spawning anything', () => {
    const result = validateSyntax('return 1 +');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  test('allows top-level await, so the wrapper must be async', () => {
    // `new Function` would reject this; only AsyncFunction accepts it.
    expect(validateSyntax('return await Promise.resolve(1)')).toEqual({ ok: true });
  });

  test('knows the conditionally injected names', () => {
    // Guards against SCOPE_KEYS drifting from the runner's parameter list.
    expect(validateSyntax('return EmbedBuilder')).toEqual({ ok: true });
    expect(validateSyntax('return time(new Date())')).toEqual({ ok: true });
  });
});

describe('normalizeMessage', () => {
  test('treats nothing-ish values as "send no message"', () => {
    expect(normalizeMessage(null)).toBeNull();
    expect(normalizeMessage(undefined)).toBeNull();
    expect(normalizeMessage('')).toBeNull();
  });

  test('wraps a string and disables mentions by default', () => {
    expect(normalizeMessage('hello')).toEqual({
      content: 'hello',
      allowedMentions: { parse: [] },
    });
  });

  test('does not let a script ping everyone by accident', () => {
    const result = normalizeMessage({ content: '@everyone deploy done' });
    expect(result?.content).toBe('@everyone deploy done');
    expect(result?.allowedMentions).toEqual({ parse: [] });
  });

  test('keeps embeds', () => {
    const result = normalizeMessage({ embeds: [{ title: 'x' }] });
    expect(result?.embeds).toEqual([{ title: 'x' }]);
  });

  test('strips fields outside the whitelist but keeps the rest', () => {
    const result = normalizeMessage({
      content: 'a',
      files: ['/etc/passwd'],
      components: [{ type: 1 }],
      tts: true,
    });
    expect(result).toEqual({ content: 'a', allowedMentions: { parse: [] } });
    expect(result).not.toHaveProperty('files');
  });

  test('returns null when everything was outside the whitelist', () => {
    expect(normalizeMessage({ tts: true, files: ['x'] })).toBeNull();
  });

  test('caps embeds at 10', () => {
    const embeds = Array.from({ length: 11 }, (_, i) => ({ title: String(i) }));
    expect(normalizeMessage({ embeds })?.embeds).toHaveLength(10);
  });

  test('truncates long content to 1900 characters', () => {
    expect(normalizeMessage('x'.repeat(5000))?.content).toHaveLength(1900);
  });

  test('renders non-objects for debugging convenience', () => {
    expect(normalizeMessage(42)?.content).toBe('42');
  });
});

describe('runInSandbox', () => {
  test(
    'returns the script value',
    async () => {
      const outcome = await run('return 2 + 2');
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.message?.content).toBe('4');
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'captures console output',
    async () => {
      const outcome = await run('console.log("hi", 1); return null');
      expect(outcome.logs).toContain('hi 1');
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.message).toBeNull();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'reports a thrown error instead of crashing the bot',
    async () => {
      const outcome = await run('throw new Error("boom")');
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error).toContain('boom');
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'kills an infinite loop — this test finishing at all is the assertion',
    async () => {
      const outcome = await run('while (true) {}', { timeoutMs: 700 });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error).toContain('Timed out');
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'cannot read the bot token: the child gets a narrowed env',
    async () => {
      // test-setup.ts sets a dummy DISCORD_TOKEN in this (parent) process, so a leak would show.
      expect(process.env.DISCORD_TOKEN).toBeTruthy();
      const outcome = await run('return process.env.DISCORD_TOKEN ?? null');
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.message).toBeNull();
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'bridges store.get and store.set over IPC',
    async () => {
      const store = memoryStore({ n: '5' });
      const outcome = await runInSandbox(
        `const n = Number(await store.get('n')) + 1;
         await store.set('n', n);
         return \`n=\${await store.get('n')}\`;`,
        { store, trigger: 'test' },
      );
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.message?.content).toBe('n=6');
      }
      expect(store.data.get('n')).toBe('6');
    },
    SPAWN_TIMEOUT,
  );

  test(
    'exposes the run context so scripts can guard side effects',
    async () => {
      const triggers = [
        ['schedule', 'schedule:false'],
        ['manual', 'manual:false'],
        ['dry-run', 'dry-run:true'],
        ['test', 'test:true'],
      ] as const;

      for (const [trigger, expected] of triggers) {
        const outcome = await run('return `${trigger}:${isDryRun}`', { trigger });
        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
          expect(outcome.message?.content).toBe(expected);
        }
      }
    },
    SPAWN_TIMEOUT * 2,
  );

  test(
    'serialises an EmbedBuilder through IPC without an explicit toJSON call',
    async () => {
      const outcome = await run(
        `const e = new EmbedBuilder().setTitle('x').setColor('#5865f2');
         return { embeds: [e] };`,
      );
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        // A hex string became a number, which the raw-object path would have rejected.
        expect(outcome.message?.embeds?.[0]).toMatchObject({ title: 'x', color: 0x5865f2 });
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'does not load discord.js when the script never mentions it',
    async () => {
      const outcome = await run('return typeof EmbedBuilder');
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.message?.content).toBe('undefined');
      }
    },
    SPAWN_TIMEOUT,
  );

  test(
    'caps runaway log output without failing the run',
    async () => {
      const outcome = await run(
        'for (let i = 0; i < 10000; i++) console.log("x".repeat(100)); return "done"',
      );
      expect(outcome.ok).toBe(true);
      expect(outcome.logs.length).toBeLessThanOrEqual(101);
      expect(outcome.logs.at(-1)).toContain('truncated');
    },
    SPAWN_TIMEOUT,
  );

  test(
    'contains a memory bomb within the timeout',
    async () => {
      // Bun has no working per-process heap cap (see the comment in sandbox.ts), so the timeout is
      // what bounds how long a runaway allocation can run. This asserts the honest guarantee:
      // it is reported as a failure, promptly, and the test process survives it.
      const startedAt = Date.now();
      const outcome = await run('const a = []; while (true) a.push(new Array(1e6).fill(0));', {
        timeoutMs: 1_500,
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error.length).toBeGreaterThan(0);
      }
      expect(Date.now() - startedAt).toBeLessThan(10_000);
    },
    SPAWN_TIMEOUT,
  );

  test(
    'runs at most two sandboxes at a time',
    async () => {
      let peak = 0;
      const sampler = setInterval(() => {
        peak = Math.max(peak, activeSandboxCount());
      }, 10);

      const outcomes = await Promise.all(
        Array.from({ length: 5 }, () => run('await Bun.sleep(150); return "ok"')),
      );
      clearInterval(sampler);

      // Exactly 2, not "at most 2": a lower number would mean the cap is enforced by accident
      // because nothing actually ran in parallel.
      expect(peak).toBe(2);
      // The queue must not drop anything while enforcing the cap.
      expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    },
    SPAWN_TIMEOUT * 2,
  );
});
