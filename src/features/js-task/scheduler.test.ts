import { afterEach, describe, expect, test } from 'bun:test';
import { Cron } from 'croner';
import { overlayStore } from './tasks';
import { stopAllJobs, validateCron } from './scheduler';

afterEach(stopAllJobs);

describe('validateCron', () => {
  test('accepts a sane expression and reports the next run', () => {
    const result = validateCron('*/5 * * * *');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextRun).toBeInstanceOf(Date);
    }
  });

  test('rejects nonsense', () => {
    expect(validateCron('not a cron')).toEqual({ ok: false, reason: 'invalid' });
  });

  test('rejects sub-minute schedules, which croner would happily accept', () => {
    // Six fields means seconds are in play; without this guard the bot would hit rate limits.
    expect(validateCron('* * * * * *')).toEqual({ ok: false, reason: 'too_frequent' });
  });

  test('accepts a once-a-minute schedule, the documented lower bound', () => {
    expect(validateCron('* * * * *').ok).toBe(true);
  });
});

describe('timezone handling', () => {
  // Fixed dates rather than "now", so the assertion does not depend on the season it runs in.
  const nextNineAm = (from: string) =>
    new Cron('0 9 * * *', { timezone: 'Europe/Warsaw', paused: true }).nextRun(new Date(from));

  test('interprets the expression in Europe/Warsaw, not UTC', () => {
    // CEST (UTC+2) in July: 09:00 local is 07:00Z.
    expect(nextNineAm('2026-07-15T00:00:00Z')?.getUTCHours()).toBe(7);
    // CET (UTC+1) in January: 09:00 local is 08:00Z.
    expect(nextNineAm('2026-01-15T00:00:00Z')?.getUTCHours()).toBe(8);
  });

  test('a UTC-interpreted expression would have been wrong in both seasons', () => {
    // Documents why CRON_TIMEZONE exists: without it both cases would report 9.
    const utc = (from: string) =>
      new Cron('0 9 * * *', { timezone: 'UTC', paused: true }).nextRun(new Date(from));
    expect(utc('2026-07-15T00:00:00Z')?.getUTCHours()).toBe(9);
    expect(utc('2026-01-15T00:00:00Z')?.getUTCHours()).toBe(9);
  });
});

describe('overlayStore', () => {
  test('reads through to the real data but discards writes', async () => {
    const persisted = new Map([['n', '5']]);
    const base = {
      get: async (key: string) => persisted.get(key) ?? null,
      set: async (key: string, value: string) => {
        persisted.set(key, value);
      },
    };

    const overlay = overlayStore(base);

    expect(await overlay.get('n')).toBe('5');
    await overlay.set('n', '9');
    // Read-your-writes inside the run: the script must behave exactly as it will in production.
    expect(await overlay.get('n')).toBe('9');
    // ...but nothing survives it, which is what makes store.set safe on a dry run.
    expect(persisted.get('n')).toBe('5');
  });

  test('is not a no-op, so a counter script still sees its own increment', async () => {
    const base = { get: async () => null, set: async () => {} };
    const overlay = overlayStore(base);
    await overlay.set('fresh', 'value');
    expect(await overlay.get('fresh')).toBe('value');
  });
});
