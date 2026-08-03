/**
 * Shared contract between the bot process and the sandbox subprocess.
 *
 * Imported by `sandbox/runner.ts`, which runs in a process deliberately started without
 * `DISCORD_TOKEN`, so this module must stay dependency-free: pulling in anything from `core/`
 * would drag in `env-config.ts`, which calls `process.exit(1)` when the token is missing.
 */

/** What caused a run. Exposed to the script so it can guard irreversible side effects. */
export type RunTrigger = 'schedule' | 'manual' | 'dry-run' | 'test';

/** Always present in the script scope. */
const BASE_SCOPE_KEYS = ['store', 'console', 'trigger', 'isDryRun'] as const;

/**
 * Injected only when the source looks like it needs them, because importing discord.js costs
 * a few hundred milliseconds on every run. Absent ones are passed as `undefined`.
 */
export const DJS_SCOPE_KEYS = [
  'EmbedBuilder',
  'time',
  'bold',
  'italic',
  'codeBlock',
  'inlineCode',
  'hyperlink',
  'quote',
] as const;

/**
 * The script's parameter list, always in this order.
 *
 * The parent compiles against the same list in `validateSyntax`, so a script using `EmbedBuilder`
 * cannot pass validation and then fail in the subprocess.
 */
export const SCOPE_KEYS: readonly string[] = [...BASE_SCOPE_KEYS, ...DJS_SCOPE_KEYS];

/**
 * Decides whether the runner pays for `import('discord.js')`.
 *
 * Deliberately crude, and it errs in the safe direction: a false positive costs one needless
 * import, a false negative surfaces as `EmbedBuilder is not a constructor` — loud and immediate,
 * never silent misbehaviour.
 */
export const DJS_HINT = new RegExp(`\\b(${DJS_SCOPE_KEYS.join('|')})\\s*[(.]`);

/** Caps applied inside the child: a `console.log` loop must not blow its heap or flood IPC. */
export const MAX_LOG_LINES = 100;
export const MAX_LOG_CHARS = 10_000;
export const LOG_TRUNCATED_MARKER = '[... log output truncated]';

export type SandboxInput = { code: string; trigger: RunTrigger };

export type ChildMessage =
  | { type: 'store:get'; id: number; key: string }
  | { type: 'store:set'; id: number; key: string; value: string }
  | { type: 'done'; ok: true; value: unknown; logs: string[] }
  | { type: 'done'; ok: false; error: string; logs: string[] };

export type ParentMessage =
  | { type: 'store:result'; id: number; value: string | null }
  | { type: 'store:error'; id: number; error: string };

export type AsyncFunctionConstructor = new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

/**
 * `AsyncFunction` is not a global, but it is reachable through any async function's constructor.
 * Used instead of `new Function` so scripts can use top-level `await` and `return`.
 */
export const AsyncFunction = async function () {}.constructor as AsyncFunctionConstructor;
