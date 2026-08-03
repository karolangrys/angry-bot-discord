/**
 * Database access for scheduled scripts. Follows the pattern of `admin-status/activity.ts`:
 * inline Drizzle queries, `.get()` for single rows, `onConflictDoUpdate` for upserts.
 */
import { and, eq, like } from 'drizzle-orm';
import { db } from '../../core/db/db-client';
import { scheduledScripts, scriptStore } from '../../core/db/schema';
import type { ScriptStore } from './sandbox';

export type ScheduledScript = typeof scheduledScripts.$inferSelect;

/** Keys with this prefix hold credentials written via `/js-task secret set`. */
export const SECRET_PREFIX = 'secret:';

/** Guards `/js-task list` against outgrowing a Discord message, and the semaphore against a pile-up. */
export const MAX_TASKS = 50;

/** Also bounds the customId length, which Discord caps at 100 characters. */
export const NAME_PATTERN = /^[a-z0-9-]{1,32}$/;

/** Longest script we can round-trip through a modal's paragraph input. */
export const MAX_CODE_LENGTH = 4000;

export async function listTasks(): Promise<ScheduledScript[]> {
  return db.select().from(scheduledScripts).all();
}

export async function countTasks(): Promise<number> {
  return (await listTasks()).length;
}

export async function getTask(name: string): Promise<ScheduledScript | undefined> {
  return db.select().from(scheduledScripts).where(eq(scheduledScripts.name, name)).get();
}

export async function upsertTask(input: {
  name: string;
  cron: string;
  code: string;
  channelId: string;
  enabled: boolean;
  createdBy: string;
}): Promise<void> {
  await db
    .insert(scheduledScripts)
    .values({ ...input, createdAt: new Date() })
    .onConflictDoUpdate({
      target: scheduledScripts.name,
      // createdAt/createdBy are not touched: an edit must not rewrite who first created the task.
      set: {
        cron: input.cron,
        code: input.code,
        channelId: input.channelId,
        enabled: input.enabled,
      },
    });
}

/** The `script_store` rows go with it, via the cascade declared in the schema. */
export async function deleteTask(name: string): Promise<void> {
  await db.delete(scheduledScripts).where(eq(scheduledScripts.name, name));
}

export async function setEnabled(name: string, enabled: boolean): Promise<void> {
  await db.update(scheduledScripts).set({ enabled }).where(eq(scheduledScripts.name, name));
}

export async function recordRun(
  name: string,
  run: { result: string | null; error: string | null },
): Promise<void> {
  await db
    .update(scheduledScripts)
    .set({ lastRunAt: new Date(), lastResult: run.result, lastError: run.error })
    .where(eq(scheduledScripts.name, name));
}

// --- store ------------------------------------------------------------------------------------

export async function storeGet(scriptName: string, key: string): Promise<string | null> {
  const row = await db
    .select({ value: scriptStore.value })
    .from(scriptStore)
    .where(and(eq(scriptStore.scriptName, scriptName), eq(scriptStore.key, key)))
    .get();
  return row?.value ?? null;
}

export async function storeSet(scriptName: string, key: string, value: string): Promise<void> {
  await db
    .insert(scriptStore)
    .values({ scriptName, key, value })
    .onConflictDoUpdate({ target: [scriptStore.scriptName, scriptStore.key], set: { value } });
}

export async function storeUnset(scriptName: string, key: string): Promise<void> {
  await db
    .delete(scriptStore)
    .where(and(eq(scriptStore.scriptName, scriptName), eq(scriptStore.key, key)));
}

/** Secret names only — the values are never read back out for display. */
export async function listSecretKeys(scriptName: string): Promise<string[]> {
  const rows = await db
    .select({ key: scriptStore.key })
    .from(scriptStore)
    .where(and(eq(scriptStore.scriptName, scriptName), like(scriptStore.key, `${SECRET_PREFIX}%`)))
    .all();
  return rows.map((row) => row.key.slice(SECRET_PREFIX.length)).sort();
}

/** The persistent store handed to a real run. */
export function taskStore(scriptName: string): ScriptStore {
  return {
    get: (key) => storeGet(scriptName, key),
    set: (key, value) => storeSet(scriptName, key, value),
  };
}

/**
 * Real reads, discarded writes — the storage a dry run gets.
 *
 * Not a no-op: writes are visible to later reads within the same run, so `get` → compute → `set` →
 * `get` behaves exactly as it will in production. Only durability is dropped, which is why
 * `store.set` needs no `if (!isDryRun)` guard in user scripts.
 */
export function overlayStore(base: ScriptStore): ScriptStore {
  const pending = new Map<string, string>();
  return {
    get: async (key) => pending.get(key) ?? (await base.get(key)),
    set: async (key, value) => {
      pending.set(key, value);
    },
  };
}
