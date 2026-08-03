/**
 * Sandbox entry point. Spawned as a separate process by `../sandbox.ts`, one process per run.
 *
 * Started with `env` narrowed to `PATH`, so it cannot read `DISCORD_TOKEN` or `DATABASE_URL`, and
 * it must not import anything from `core/` (see the note in `../sandbox-protocol.ts`). The only
 * permitted `node_modules` import is discord.js, loaded conditionally below.
 *
 * A fresh process per run is the point: leaks die with it, and the parent's `kill()` is what stops
 * an infinite loop. Nothing here is expected to survive between runs.
 */
import {
  AsyncFunction,
  DJS_HINT,
  DJS_SCOPE_KEYS,
  LOG_TRUNCATED_MARKER,
  MAX_LOG_CHARS,
  MAX_LOG_LINES,
  SCOPE_KEYS,
  type ChildMessage,
  type ParentMessage,
  type SandboxInput,
} from '../sandbox-protocol';

const send = (message: ChildMessage): void => {
  process.send?.(message);
};

// --- Captured console -------------------------------------------------------------------------

const logs: string[] = [];
let logChars = 0;
let logsTruncated = false;

const format = (value: unknown): string => (typeof value === 'string' ? value : Bun.inspect(value));

const record = (...args: unknown[]): void => {
  if (logsTruncated) {
    return;
  }
  if (logs.length >= MAX_LOG_LINES || logChars >= MAX_LOG_CHARS) {
    // Capped in the child on purpose: a `console.log` loop would otherwise blow this process's
    // heap, flood the IPC channel and land in `last_result` before the parent could intervene.
    logs.push(LOG_TRUNCATED_MARKER);
    logsTruncated = true;
    return;
  }
  const line = args.map(format).join(' ');
  logs.push(line);
  logChars += line.length;
};

const captured = { log: record, info: record, warn: record, error: record, debug: record };

// --- store bridge -----------------------------------------------------------------------------

let nextRequestId = 0;
const pending = new Map<
  number,
  { resolve: (value: string | null) => void; reject: (error: Error) => void }
>();

// Registered before the first `send`, so a fast reply from the parent cannot arrive unobserved.
process.on('message', (raw: unknown) => {
  const message = raw as ParentMessage;
  const entry = pending.get(message.id);
  if (!entry) {
    return;
  }
  pending.delete(message.id);
  if (message.type === 'store:error') {
    entry.reject(new Error(message.error));
  } else {
    entry.resolve(message.value);
  }
});

const ask = (build: (id: number) => ChildMessage): Promise<string | null> => {
  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send(build(id));
  });
};

const store = {
  get: (key: string): Promise<string | null> => ask((id) => ({ type: 'store:get', id, key })),
  set: async (key: string, value: unknown): Promise<void> => {
    // Coerced because the column is TEXT and `store.set('n', 5)` is the obvious thing to write.
    await ask((id) => ({ type: 'store:set', id, key, value: String(value) }));
  },
};

// --- execution --------------------------------------------------------------------------------

/**
 * Makes the returned value survive JSON IPC.
 *
 * `JSON.stringify` invokes `toJSON()`, which is why returning an `EmbedBuilder` instance works
 * without the script calling `.toJSON()` itself. This only holds because the parent spawns us with
 * `serialization: 'json'` — switching to `'advanced'` (structuredClone) would silently stop
 * converting class instances.
 */
const toSerializable = (value: unknown): unknown => {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    // Circular, or a function/symbol that stringifies to undefined.
    return Bun.inspect(value);
  }
};

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
};

const { code, trigger } = JSON.parse(await Bun.stdin.text()) as SandboxInput;

const scope: Record<string, unknown> = {
  store,
  console: captured,
  trigger,
  isDryRun: trigger === 'dry-run' || trigger === 'test',
};

if (DJS_HINT.test(code)) {
  // Resolved against this file's location, not `cwd`, so the tmpdir working directory is
  // irrelevant. Safe to load: without a token nothing here can build a working Client.
  const djs = (await import('discord.js')) as unknown as Record<string, unknown>;
  for (const key of DJS_SCOPE_KEYS) {
    scope[key] = djs[key];
  }
}

try {
  // Compiling and calling are separate steps: a SyntaxError here means nothing ran at all.
  const script = new AsyncFunction(...SCOPE_KEYS, code);
  const value = await script(...SCOPE_KEYS.map((key) => scope[key]));
  send({ type: 'done', ok: true, value: toSerializable(value), logs });
} catch (error) {
  send({ type: 'done', ok: false, error: describeError(error), logs });
}

// The IPC channel keeps the event loop alive, so the process has to be told to leave. The short
// delay lets the final message flush; the parent does not depend on it — it kills us either way.
setTimeout(() => process.exit(0), 10);
