import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import winston from 'winston';
import { env } from './env-config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const SPLAT = Symbol.for('splat');
const DETAILS = Symbol.for('angry-bot:log-details');

function describe(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Winston puts every argument after the message into `info[Symbol.for('splat')]`. The line format
 * below only reads `stack`/`message`, so without this step a call such as
 * `logger.error('Uncaught exception:', error)` prints the prefix and silently drops the error and
 * its stack trace — precisely the information needed to debug the failure.
 */
const collectDetails = winston.format((info) => {
  const splat = (info as Record<symbol, unknown>)[SPLAT];
  if (Array.isArray(splat) && splat.length > 0) {
    const rendered = splat.map(describe).filter((part) => part.length > 0);
    if (rendered.length > 0) {
      (info as Record<symbol, unknown>)[DETAILS] = rendered.join(' ');
    }
  }
  return info;
});

/** Exported so tests can attach a transport and assert on the rendered line. */
export const logLineFormat = printf((info) => {
  const details = (info as Record<symbol, unknown>)[DETAILS];
  const message = String(info.message);
  const stack = typeof info.stack === 'string' ? info.stack : undefined;

  let body: string;
  if (details) {
    // `errors({ stack: true })` also hoists the stack of an Error passed as an extra argument, so
    // preferring `stack` here would drop the prefix message and print the trace twice.
    body = `${message} ${String(details)}`;
  } else if (stack) {
    // The Error itself was the message, and a stack already starts with that message.
    body = stack;
  } else {
    body = message;
  }

  return `${String(info.timestamp)} [${info.level}]: ${body}`;
});

const isTest = env.NODE_ENV === 'test';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(colorize(), logLineFormat),
    silent: isTest,
  }),
];

if (!isTest) {
  // Winston's File transport does not create missing directories, and in the container the log
  // directory lives on a mounted volume.
  mkdirSync(env.LOG_DIR, { recursive: true });
  transports.push(
    new winston.transports.File({
      filename: join(env.LOG_DIR, 'error.log'),
      level: 'error',
      format: logLineFormat,
    }),
    new winston.transports.File({
      filename: join(env.LOG_DIR, 'combined.log'),
      format: logLineFormat,
    }),
  );
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  // Shared pipeline only; each transport renders the final line itself so nothing is formatted twice.
  format: combine(
    errors({ stack: true }),
    collectDetails(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  ),
  exitOnError: false,
  transports,
});

/**
 * File transports write asynchronously, so a bare `process.exit()` can discard the last — and
 * usually most important — log lines. Await this before exiting.
 */
export function flushLogs(timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    logger.once('finish', () => {
      clearTimeout(timer);
      resolve();
    });
    logger.end();
  });
}
