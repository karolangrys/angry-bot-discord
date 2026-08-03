/**
 * Owns the cron timers and the "run one task" path shared by the scheduler, `/js-task run` and the
 * dry run performed when a task is saved.
 */
import { Cron } from 'croner';
import type { Client } from 'discord.js';
import i18next from 'i18next';
import { env } from '../../core/env-config';
import { DEFAULT_LOCALE } from '../../core/i18n';
import { logger } from '../../core/logger';
import { NAMESPACE } from './locales';
import { runInSandbox, type RunTrigger, type SandboxOutcome, type ScriptMessage } from './sandbox';
import { getTask, listTasks, overlayStore, recordRun, taskStore } from './tasks';

/**
 * Croner understands seconds, so `* * * * * *` is a valid expression that would hammer Discord's
 * rate limits. Rejected at save time, where the author gets a clear message.
 */
const MIN_INTERVAL_MS = 60_000;

/** Runtime backstop for the same thing, in seconds, enforced by croner itself. */
const MIN_INTERVAL_SECONDS = MIN_INTERVAL_MS / 1000;

/** Enough to recognise a run in `/js-task show` without storing the whole message. */
const MAX_STORED_RESULT = 500;

const jobs = new Map<string, Cron>();

export type CronValidation =
  { ok: true; nextRun: Date | null } | { ok: false; reason: 'invalid' | 'too_frequent' };

/**
 * Checks an expression without scheduling it. Croner throws from the constructor on a malformed
 * pattern, which is the cheapest available validation.
 */
export function validateCron(expression: string): CronValidation {
  let probe: Cron;
  try {
    probe = new Cron(expression, { timezone: env.CRON_TIMEZONE, paused: true });
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  try {
    const [first, second] = probe.nextRuns(2);
    if (!first || !second) {
      // A pattern that can never run twice (e.g. a one-off date) is not useful here.
      return { ok: false, reason: 'invalid' };
    }
    if (second.getTime() - first.getTime() < MIN_INTERVAL_MS) {
      return { ok: false, reason: 'too_frequent' };
    }
    return { ok: true, nextRun: first };
  } finally {
    probe.stop();
  }
}

export function scheduleTask(client: Client<true>, name: string, expression: string): void {
  unscheduleTask(name);

  const job = new Cron(
    expression,
    {
      name,
      timezone: env.CRON_TIMEZONE,
      // Stops a slow task from overlapping itself; the cross-task cap lives in sandbox.ts.
      protect: true,
      interval: MIN_INTERVAL_SECONDS,
      // Belt and braces: runTask already swallows everything, but an unhandled throw in a cron
      // callback would become an unhandledRejection, which index.ts answers by killing the bot.
      catch: (error: unknown) => logger.error(`Unhandled error in js-task "${name}":`, error),
    },
    () => {
      void runTask(client, name, 'schedule');
    },
  );

  jobs.set(name, job);
}

export function unscheduleTask(name: string): void {
  jobs.get(name)?.stop();
  jobs.delete(name);
}

/** Used by tests so pending timers do not keep `bun test` alive. */
export function stopAllJobs(): void {
  for (const name of [...jobs.keys()]) {
    unscheduleTask(name);
  }
}

export function nextRunOf(name: string): Date | null {
  return jobs.get(name)?.nextRun() ?? null;
}

export function isScheduled(name: string): boolean {
  return jobs.has(name);
}

/**
 * Runs one task. Reads the row every time rather than closing over the code, so `/js-task edit`
 * takes effect without rescheduling the timer.
 *
 * Only a `schedule` run publishes to the task's channel; the other triggers show their result to
 * the person who asked, so saving or testing a task never spams the channel.
 */
export async function runTask(
  client: Client<true>,
  name: string,
  trigger: RunTrigger,
): Promise<SandboxOutcome | null> {
  const task = await getTask(name);
  if (!task) {
    logger.warn(`js-task "${name}" fired but is no longer stored; unscheduling.`);
    unscheduleTask(name);
    return null;
  }
  if (!task.enabled && trigger === 'schedule') {
    return null;
  }

  const persistent = taskStore(name);
  const outcome = await runInSandbox(task.code, {
    trigger,
    store: trigger === 'dry-run' ? overlayStore(persistent) : persistent,
  });

  if (trigger === 'schedule') {
    await publish(client, task.channelId, name, outcome);
  }

  await persistOutcome(name, outcome);
  return outcome;
}

async function publish(
  client: Client<true>,
  channelId: string,
  name: string,
  outcome: SandboxOutcome,
): Promise<void> {
  if (!outcome.ok) {
    logger.error(`js-task "${name}" failed: ${outcome.error}`);
    await notifyOwner(client, 'dm_failed', { name, error: outcome.error });
    return;
  }
  if (!outcome.message) {
    // A script returning nothing is a supported way to write side-effect-only tasks.
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      throw new Error(`Channel ${channelId} is not a text channel the bot can post to`);
    }
    await channel.send(outcome.message);
  } catch (error) {
    // Deleted channel, revoked permission, embed rejected by the API. Must never propagate: this
    // runs inside a cron callback.
    logger.error(`js-task "${name}" could not post to channel ${channelId}:`, error);
    await notifyOwner(client, 'dm_channel_failed', { name });
  }
}

async function persistOutcome(name: string, outcome: SandboxOutcome): Promise<void> {
  try {
    await recordRun(name, {
      result: outcome.ok ? summarise(outcome.message) : null,
      error: outcome.ok ? null : outcome.error.slice(0, MAX_STORED_RESULT),
    });
  } catch (error) {
    logger.error(`Could not record the run of js-task "${name}":`, error);
  }
}

function summarise(message: ScriptMessage | null): string | null {
  if (!message) {
    return null;
  }
  const text = message.content ?? (message.embeds ? JSON.stringify(message.embeds) : '');
  return text.slice(0, MAX_STORED_RESULT) || null;
}

/**
 * Best-effort: a failing task should reach the owner even when the channel is unusable.
 *
 * There is no interaction here to read a locale from, so this uses the default one. Going through
 * i18next anyway keeps every user-facing string in `locales.ts`.
 */
async function notifyOwner(
  client: Client<true>,
  key: 'dm_failed' | 'dm_channel_failed',
  values: Record<string, string>,
): Promise<void> {
  const ownerId = env.OWNER_IDS[0];
  if (!ownerId) {
    return;
  }
  try {
    const t = i18next.getFixedT(DEFAULT_LOCALE, NAMESPACE);
    const owner = await client.users.fetch(ownerId);
    await owner.send(t(key, values));
  } catch (error) {
    logger.error('Could not DM the owner about a failed js-task:', error);
  }
}

/**
 * Restores the schedule after a restart, mirroring how `admin-status` restores the presence.
 *
 * Missed runs are deliberately not backfilled: after an hour of downtime nobody wants twelve
 * queued messages at once.
 */
export async function startScheduler(client: Client<true>): Promise<void> {
  let scheduled = 0;
  try {
    for (const task of await listTasks()) {
      if (!task.enabled) {
        continue;
      }
      // Stored expressions can be invalid: a task whose cron failed validation is saved disabled,
      // and `toggle` re-validates, but a hand-edited database should not stop the rest from loading.
      const validation = validateCron(task.cron);
      if (!validation.ok) {
        logger.warn(`js-task "${task.name}" has an unusable cron expression; leaving it stopped.`);
        continue;
      }
      scheduleTask(client, task.name, task.cron);
      scheduled += 1;
    }
    logger.info(`js-task: scheduled ${scheduled} task(s) in timezone ${env.CRON_TIMEZONE}.`);
  } catch (error) {
    logger.error('Could not start the js-task scheduler:', error);
  }
}
