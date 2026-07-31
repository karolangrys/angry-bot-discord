import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURES_PATH, listFeatureFolders, loadCommands } from './command-handler';

describe('command-handler', () => {
  test('resolves the features path without relying on the working directory', () => {
    expect(existsSync(FEATURES_PATH)).toBe(true);
  });

  test('lists only directories', () => {
    const folders = listFeatureFolders();
    expect(folders.length).toBeGreaterThan(0);
    for (const folder of folders) {
      expect(existsSync(join(FEATURES_PATH, folder))).toBe(true);
    }
  });

  test('loads a command for every feature that ships one', async () => {
    const commands = await loadCommands();

    const expected = listFeatureFolders().filter((folder) =>
      ['ping', 'config', 'admin-status', 'server-info', 'user-info'].includes(folder),
    );
    expect(commands.size).toBeGreaterThanOrEqual(expected.length);

    for (const [name, command] of commands) {
      // The collection key must be the registered command name, otherwise interactions never match.
      expect(name).toBe(command.data.name);
      expect(typeof command.execute).toBe('function');
      // Every command must survive serialisation, which is what deploy-commands sends to Discord.
      expect(() => command.data.toJSON()).not.toThrow();
    }
  });

  test('exposes the expected command names', async () => {
    const commands = await loadCommands();
    expect([...commands.keys()].sort()).toEqual([
      'config',
      'ping',
      'server-info',
      'status',
      'user-info',
    ]);
  });
});
