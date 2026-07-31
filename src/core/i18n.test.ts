import { beforeEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import i18next from 'i18next';
import { db } from './db/db-client';
import { guildConfigs } from './db/schema';
import { FEATURES_PATH, listFeatureFolders } from './command-handler';
import { clearGuildLanguageCache, getT, invalidateGuildLanguage } from './i18n';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './i18n-config';
import { NAMESPACE as CORE_NAMESPACE } from './locales';
import { createInteraction, contentOf } from '../test-support';

type LocaleModule = {
  default?: Record<string, Record<string, unknown>>;
  NAMESPACE?: string;
};

async function loadFeatureLocales(): Promise<{ folder: string; module: LocaleModule }[]> {
  const bundles: { folder: string; module: LocaleModule }[] = [];

  for (const folder of listFeatureFolders()) {
    const localesPath = join(FEATURES_PATH, folder, 'locales.ts');
    if (!existsSync(localesPath)) {
      continue;
    }
    bundles.push({
      folder,
      module: (await import(pathToFileURL(localesPath).href)) as LocaleModule,
    });
  }

  return bundles;
}

/** Flattens nested translation objects into dotted key paths for set comparison. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, nested]) =>
      keyPaths(nested, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

// initI18n() already ran in the test preload (src/test-setup.ts).
describe('i18n', () => {
  test('registers the core namespace', () => {
    for (const language of SUPPORTED_LOCALES) {
      expect(i18next.hasResourceBundle(language, CORE_NAMESPACE)).toBe(true);
    }
  });

  test('SUPPORTED_LOCALES matches the keys defined in core locales', async () => {
    const coreLocaleKeys = Object.keys(
      (await import('./locales')).default,
    ).sort();
    const supported = ([...SUPPORTED_LOCALES] as string[]).sort();
    expect(supported).toEqual(coreLocaleKeys);
  });

  test('every feature exports a NAMESPACE and gets it registered for every locale', async () => {
    const bundles = await loadFeatureLocales();
    expect(bundles.length).toBeGreaterThan(0);

    for (const { folder, module } of bundles) {
      // Relying on the folder name instead of an explicit export is what broke `admin-status`.
      expect(typeof module.NAMESPACE, `${folder} must export NAMESPACE`).toBe('string');

      for (const language of SUPPORTED_LOCALES) {
        expect(
          i18next.hasResourceBundle(language, module.NAMESPACE as string),
          `${folder}: namespace "${module.NAMESPACE}" is missing for ${language}`,
        ).toBe(true);
      }
    }
  });

  test('all locales of a feature define exactly the same keys', async () => {
    for (const { folder, module } of await loadFeatureLocales()) {
      const bundle = module.default ?? {};
      const reference = keyPaths(bundle[DEFAULT_LOCALE]).sort();

      for (const language of SUPPORTED_LOCALES) {
        expect(keyPaths(bundle[language]).sort(), `${folder} / ${language}`).toEqual(reference);
      }
    }
  });

  describe('getT', () => {
    beforeEach(() => {
      clearGuildLanguageCache();
    });

    test('falls back to the client locale outside a guild', async () => {
      const { interaction } = createInteraction({ locale: 'pl', guildId: null });
      const t = await getT(interaction, 'ping');
      expect(contentOf(t('response', { latency: 1, gateway: 2 }))).toContain('Czas odpowiedzi');
    });

    test('falls back to the default locale for an unsupported client locale', async () => {
      const { interaction } = createInteraction({ locale: 'de', guildId: null });
      const t = await getT(interaction, 'ping');
      expect(t('response', { latency: 1, gateway: 2 })).toContain('Round-trip');
    });

    test('prefers the stored guild language over the client locale', async () => {
      const guildId = 'guild-i18n-1';
      await db.insert(guildConfigs).values({ guildId, language: 'pl' });
      invalidateGuildLanguage(guildId);

      const { interaction } = createInteraction({ locale: 'en-US', guildId });
      const t = await getT(interaction, 'ping');
      expect(t('response', { latency: 1, gateway: 2 })).toContain('Czas odpowiedzi');
    });

    test('serves an updated guild language only after the cache is invalidated', async () => {
      const guildId = 'guild-i18n-2';
      await db.insert(guildConfigs).values({ guildId, language: 'pl' });

      const { interaction } = createInteraction({ locale: 'en-US', guildId });
      expect((await getT(interaction, 'ping'))('response', { latency: 1, gateway: 2 })).toContain(
        'Czas odpowiedzi',
      );

      await db
        .update(guildConfigs)
        .set({ language: 'en-US' })
        .where(eq(guildConfigs.guildId, guildId));

      // Still cached, therefore still Polish.
      expect((await getT(interaction, 'ping'))('response', { latency: 1, gateway: 2 })).toContain(
        'Czas odpowiedzi',
      );

      invalidateGuildLanguage(guildId);
      expect((await getT(interaction, 'ping'))('response', { latency: 1, gateway: 2 })).toContain(
        'Round-trip',
      );
    });
  });
});
