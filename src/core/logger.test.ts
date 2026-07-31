import { describe, expect, test } from 'bun:test';
import { Writable } from 'node:stream';
import winston from 'winston';
import { logLineFormat, logger } from './logger';

/** Captures whatever the logger renders, so the assertions cover the real Winston pipeline. */
async function capture(emit: () => void): Promise<string> {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });

  const transport = new winston.transports.Stream({ stream, format: logLineFormat });
  logger.add(transport);
  try {
    emit();
    // Flush deterministically instead of relying on a hardcoded timeout.
    await new Promise<void>((resolve) => {
      stream.once('finish', resolve);
      stream.end();
    });
  } finally {
    logger.remove(transport);
  }

  return chunks.join('');
}

describe('logger', () => {
  test('keeps details passed as extra arguments', async () => {
    // The previous format only read `stack`/`message`, so this call printed the prefix alone and
    // dropped the error — exactly where a stack trace matters most.
    const output = await capture(() => {
      logger.error('Uncaught exception:', new Error('boom'));
    });

    expect(output).toContain('Uncaught exception:');
    expect(output).toContain('Error: boom');
    expect(output).toContain('logger.test');
  });

  test('renders the stack when an Error is the message', async () => {
    const output = await capture(() => {
      logger.error(new Error('direct'));
    });

    expect(output).toContain('Error: direct');
  });

  test('serialises non-Error details', async () => {
    const output = await capture(() => {
      logger.error('context:', { guildId: '123' });
    });

    expect(output).toContain('context:');
    expect(output).toContain('123');
  });

  test('includes a timestamp and the level', async () => {
    const output = await capture(() => {
      logger.error('plain message');
    });

    expect(output).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[error\]: plain message/);
  });
});
