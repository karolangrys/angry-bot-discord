import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';
import i18next, { type Resource } from 'i18next';
import { FEATURES_PATH, listFeatureFolders } from './command-handler';
import { db } from './db/db-client';
import { guildConfigs } from './db/schema';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './i18n-config';
import coreLocales, { NAMESPACE as CORE_NAMESPACE } from './locales';
import { logger } from './logger';

export { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES };
export type { SupportedLocale };

type LocaleModule = {
  default?: Record<string, Record<string, unknown>>;
  NAMESPACE?: string;
};

function addBundle(
  resources: Resource,
  namespace: string,
  bundle: Record<string, Record<string, unknown>>,
): void {
  for (const [language, strings] of Object.entries(bundle)) {
    const forLanguage = (resources[language] ??= {});
    forLanguage[namespace] = strings;
  }
}

export async function initI18n(): Promise<void> {
  const resources: Resource = {};
  addBundle(resources, CORE_NAMESPACE, coreLocales);

  for (const folder of listFeatureFolders()) {
    const localesPath = join(FEATURES_PATH, folder, 'locales.ts');
    if (!existsSync(localesPath)) {
      continue;
    }

    try {
      const localeModule = (await import(pathToFileURL(localesPath).href)) as LocaleModule;
      if (!localeModule.default) {
        logger.warn(`Feature ${folder} has a locales.ts without a default export; skipping.`);
        continue;
      }

      // The namespace comes from the module itself, not from the folder name. Deriving it from the
      // folder silently broke `admin-status`, whose command asked for the namespace "status".
      const namespace = localeModule.NAMESPACE ?? folder;
      addBundle(resources, namespace, localeModule.default);
      logger.debug(`Loaded locales for namespace ${namespace} from feature ${folder}.`);
    } catch (error) {
      // Scoped per feature so one bad locales file does not leave the bot untranslated.
      logger.error(`Failed to load locales for feature ${folder}:`, error);
    }
  }

  await i18next.init({
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    defaultNS: CORE_NAMESPACE,
    ns: Object.keys(resources[DEFAULT_LOCALE] ?? {}),
    resources,
    interpolation: {
      escapeValue: false, // Discord renders plain text, not HTML.
    },
  });
}

/**
 * Guild language cache. Without it every single interaction cost a database round trip.
 * `null` means "no override stored", which is a valid cacheable answer.
 */
const guildLanguageCache = new Map<string, SupportedLocale | null>();

/** Must be called after writing `guild_configs.language`, otherwise the old value is served. */
export function invalidateGuildLanguage(guildId: string): void {
  guildLanguageCache.delete(guildId);
}

/** Test helper: drops every cached entry. */
export function clearGuildLanguageCache(): void {
  guildLanguageCache.clear();
}

async function resolveGuildLanguage(guildId: string): Promise<SupportedLocale | null> {
  const cached = guildLanguageCache.get(guildId);
  if (cached !== undefined) {
    return cached;
  }

  let language: SupportedLocale | null = null;
  try {
    const config = await db
      .select({ language: guildConfigs.language })
      .from(guildConfigs)
      .where(eq(guildConfigs.guildId, guildId))
      .get();

    if (isSupportedLocale(config?.language)) {
      language = config.language;
    }
  } catch (error) {
    // Looking up a translation must never take a command down; fall back to the client locale.
    logger.error(`Could not read the language setting for guild ${guildId}:`, error);
    return null; // Deliberately not cached, so the next call retries.
  }

  guildLanguageCache.set(guildId, language);
  return language;
}

export async function getT(interaction: ChatInputCommandInteraction, namespace: string) {
  const guildLanguage = interaction.guildId
    ? await resolveGuildLanguage(interaction.guildId)
    : null;

  const clientLocale: string | undefined = interaction.locale;
  const language =
    guildLanguage ?? (isSupportedLocale(clientLocale) ? clientLocale : DEFAULT_LOCALE);

  return i18next.getFixedT(language, namespace);
}
