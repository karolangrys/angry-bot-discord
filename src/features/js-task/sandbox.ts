/**
 * Runs a user-supplied script in a separate process and turns its return value into something safe
 * to hand to `channel.send()`.
 *
 * The isolation here defends against mistakes, not against a hostile author: an infinite loop, a
 * memory leak, a thrown exception or a script reading the bot token. A subprocess with a narrowed
 * `env` and a hard timeout covers all four. The actual authorisation is `isBotOwner()`.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { APIEmbed, MessageMentionOptions } from 'discord.js';
import {
  AsyncFunction,
  SCOPE_KEYS,
  type ChildMessage,
  type RunTrigger,
  type SandboxInput,
} from './sandbox-protocol';

export type { RunTrigger };

const SANDBOX_TIMEOUT_MS = 10_000;

/**
 * Two at a time. `protect: true` in croner only stops one task overlapping itself, so without this
 * ten tasks sharing `0 * * * *` would spawn ten processes and blow the container's memory limit.
 */
const MAX_CONCURRENT = 2;

/** Discord's message limit is 2000; leave room for a prefix added by the caller. */
const MAX_CONTENT_CHARS = 1_900;
const MAX_EMBEDS = 10;

/**
 * There is deliberately no per-child memory cap here, because Bun has no working one.
 *
 * Measured on Bun 1.3.14: `--smol`, `--max-old-space-size` and `BUN_JSC_forceRAMSize` all failed to
 * stop `while (true) a.push(new Array(1e6))` — it kept allocating until killed by the timeout.
 * (`BUN_JSC_forceRAMSize` is a valid JSC variable, but it only hints at available RAM; invalid
 * `BUN_JSC_*` names make Bun exit immediately, which is how we know the name was accepted.)
 *
 * So the enforcement lives in the container's cgroup instead. Measured under `--memory 512m`: the
 * subprocess is OOM-killed after ~2.6s and this process survives, because the kernel picks the
 * largest consumer — which is why `mem_limit` in docker-compose.yml is mandatory rather than
 * tuning. Outside a container the timeout below is the only bound.
 *
 * `--smol` is still passed, but only because it lowers the footprint of ordinary runs.
 */

/** Resolved from this file's location rather than `process.cwd()`, matching FEATURES_PATH. */
const RUNNER_PATH = join(import.meta.dir, 'sandbox', 'runner.ts');

/** Mentions are off unless the script asks for them: text pulled from an API must not ping. */
const NO_MENTIONS: MessageMentionOptions = { parse: [] };

export type ScriptStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

/**
 * The whitelisted subset of MessageCreateOptions a script may produce. Deliberately narrow:
 * the payload comes from arbitrary code, so `files`, `components` and `poll` never pass through.
 */
export type ScriptMessage = {
  content?: string;
  embeds?: APIEmbed[];
  allowedMentions?: MessageMentionOptions;
};

export type SandboxOutcome =
  | { ok: true; message: ScriptMessage | null; logs: string[]; durationMs: number }
  | { ok: false; error: string; logs: string[]; durationMs: number };

// --- syntax check -----------------------------------------------------------------------------

/**
 * Compiles the script without running it, so a typo comes back in milliseconds instead of after a
 * full spawn cycle. Constructing a function parses but never executes, so this has no side effects.
 *
 * Uses the same SCOPE_KEYS as the runner, so a script referencing `EmbedBuilder` cannot pass here
 * and then fail in the subprocess.
 */
export function validateSyntax(code: string): { ok: true } | { ok: false; error: string } {
  try {
    new AsyncFunction(...SCOPE_KEYS, code);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// --- message normalisation --------------------------------------------------------------------

const truncate = (text: string): string =>
  text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Turns whatever the script returned into a payload we are willing to send.
 *
 * Runs in the bot process, never in the runner: a whitelist enforced inside the process that
 * executes arbitrary code would only be a suggestion.
 */
export function normalizeMessage(value: unknown): ScriptMessage | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    return { content: truncate(value), allowedMentions: NO_MENTIONS };
  }

  if (!isPlainObject(value)) {
    // Numbers, booleans, arrays — most likely someone debugging.
    return { content: truncate(Bun.inspect(value)), allowedMentions: NO_MENTIONS };
  }

  const message: ScriptMessage = {};

  if (typeof value.content === 'string' && value.content.length > 0) {
    message.content = truncate(value.content);
  }

  if (Array.isArray(value.embeds) && value.embeds.length > 0) {
    // Embeds are not truncated: they have their own limits (6000 chars, 25 fields) and silently
    // trimming one produces gibberish. An oversized embed fails loudly via the Discord API and
    // ends up in `last_error`, which is more useful than a mangled message.
    message.embeds = value.embeds.slice(0, MAX_EMBEDS) as APIEmbed[];
  }

  if (message.content === undefined && message.embeds === undefined) {
    // Everything the script sent was outside the whitelist (`files`, `components`, `tts`, ...).
    return null;
  }

  message.allowedMentions = isPlainObject(value.allowedMentions)
    ? (value.allowedMentions as MessageMentionOptions)
    : NO_MENTIONS;

  return message;
}

// --- concurrency ------------------------------------------------------------------------------

let active = 0;
const waiting: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  // The slot was handed over by releaseSlot without decrementing, so `active` already counts it.
}

function releaseSlot(): void {
  const next = waiting.shift();
  if (next) {
    // Transfer the slot directly. Decrementing first would let a new caller take it in between,
    // pushing `active` past the cap.
    next();
    return;
  }
  active -= 1;
}

/** Test helper: number of sandboxes currently holding a slot. */
export function activeSandboxCount(): number {
  return active;
}

// --- execution --------------------------------------------------------------------------------

export async function runInSandbox(
  code: string,
  options: { store: ScriptStore; trigger: RunTrigger; timeoutMs?: number },
): Promise<SandboxOutcome> {
  await acquireSlot();
  try {
    return await spawnRun(code, options);
  } finally {
    releaseSlot();
  }
}

async function spawnRun(
  code: string,
  options: { store: ScriptStore; trigger: RunTrigger; timeoutMs?: number },
): Promise<SandboxOutcome> {
  const timeoutMs = options.timeoutMs ?? SANDBOX_TIMEOUT_MS;
  const startedAt = Date.now();

  let settled = false;
  let result: { ok: true; value: unknown } | { ok: false; error: string } | null = null;
  let logs: string[] = [];
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });

  const child = Bun.spawn({
    cmd: [process.execPath, '--smol', RUNNER_PATH],
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    serialization: 'json',
    cwd: tmpdir(),
    // Narrowed on purpose: with the full environment the script could read DISCORD_TOKEN and
    // DATABASE_URL straight out of process.env.
    env: { PATH: process.env.PATH ?? '' },
    ipc(raw, subprocess) {
      void handleMessage(raw as ChildMessage, subprocess);
    },
  });

  async function handleMessage(
    message: ChildMessage,
    subprocess: { send(payload: unknown): void },
  ): Promise<void> {
    if (message.type === 'store:get' || message.type === 'store:set') {
      try {
        if (message.type === 'store:get') {
          const value = await options.store.get(message.key);
          subprocess.send({ type: 'store:result', id: message.id, value });
        } else {
          await options.store.set(message.key, message.value);
          subprocess.send({ type: 'store:result', id: message.id, value: null });
        }
      } catch (error) {
        subprocess.send({
          type: 'store:error',
          id: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // `done` racing the timeout: whichever gets here first wins, the other is ignored.
    if (settled) {
      return;
    }
    settled = true;
    logs = message.logs;
    result = message.ok ? { ok: true, value: message.value } : { ok: false, error: message.error };
    finish();
  }

  // Drained from the start, not after exit: an unread pipe fills up and blocks the child on write,
  // which would look like a hung script rather than a plumbing problem.
  const stdoutText = new Response(child.stdout).text();
  const stderrText = new Response(child.stderr).text();

  child.stdin.write(JSON.stringify({ code, trigger: options.trigger } satisfies SandboxInput));
  child.stdin.end();

  const timer = setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    // Technical diagnostics, like a stack trace: shown as-is rather than translated. The
    // surrounding user-facing wording is localised by the command.
    result = { ok: false, error: `Timed out after ${timeoutMs}ms` };
    finish();
  }, timeoutMs);

  // A child that dies without sending `done` — heap limit, segfault, process.exit in the script —
  // would otherwise sit here until the timeout and then be misreported as a hang. The drained
  // stderr appended below usually carries the real reason.
  void child.exited.then((exitCode) => {
    if (settled) {
      return;
    }
    settled = true;
    result = { ok: false, error: `Sandbox exited with code ${exitCode} before returning a result` };
    finish();
  });

  await finished;
  clearTimeout(timer);

  // Always kill: on the timeout path this is what stops the loop, and on the happy path the child
  // is already leaving, so this only makes the parent authoritative about when it is gone.
  child.kill(9);
  await child.exited;

  const [out, err] = await Promise.all([stdoutText, stderrText]);
  const drained = [
    ...(out.trim() ? [`[stdout] ${out.trim()}`] : []),
    ...(err.trim() ? [`[stderr] ${err.trim()}`] : []),
  ];
  const allLogs = [...logs, ...drained];
  const durationMs = Date.now() - startedAt;

  // Narrowed by hand: TypeScript cannot see that `finished` only resolves after `result` is set.
  const outcome = result as { ok: true; value: unknown } | { ok: false; error: string } | null;
  if (!outcome) {
    return { ok: false, error: 'Sandbox produced no result', logs: allLogs, durationMs };
  }

  return outcome.ok
    ? { ok: true, message: normalizeMessage(outcome.value), logs: allLogs, durationMs }
    : { ok: false, error: outcome.error, logs: allLogs, durationMs };
}
