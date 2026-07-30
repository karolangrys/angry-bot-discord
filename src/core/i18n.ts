import i18next, { Resource } from 'i18next';
import { ChatInputCommandInteraction } from 'discord.js';
import { db } from './db/db-client';
import { guildConfigs } from './db/schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';
import { readdirSync } from 'fs';
import { join } from 'path';

export const SUPPORTED_LOCALES = ['en-US', 'pl'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// Central initialization
export async function initI18n() {
  const resources: Resource = {};
  
  const featuresPath = join(process.cwd(), 'src', 'features');
  try {
    const featureFolders = readdirSync(featuresPath);
    
    for (const folder of featureFolders) {
      const featurePath = join(featuresPath, folder);
      const files = readdirSync(featurePath);
      
      if (files.includes('locales.ts')) {
        const localesModule = await import(join(featurePath, 'locales.ts'));
        const namespaceLocales = localesModule.default;
        
        // namespaceLocales should be like { 'en-US': { name: '...', ... }, 'pl': { ... } }
        for (const lng of Object.keys(namespaceLocales)) {
          if (!resources[lng]) {
            resources[lng] = {};
          }
          resources[lng][folder] = namespaceLocales[lng];
        }
      }
    }
  } catch (error) {
    logger.error(`Error loading locales: ${error}`);
  }

  await i18next.init({
    fallbackLng: 'en-US',
    resources,
    interpolation: {
      escapeValue: false, // not needed for discord
    },
  });
}

export async function getT(interaction: ChatInputCommandInteraction, namespace: string) {
  let lng = interaction.locale as string;

  if (interaction.guildId) {
    const guildConfig = await db.select().from(guildConfigs).where(eq(guildConfigs.guildId, interaction.guildId)).get();
    if (guildConfig && guildConfig.language) {
      lng = guildConfig.language;
    }
  }

  // Fallback to english if language is not supported
  if (!SUPPORTED_LOCALES.includes(lng as SupportedLocale)) {
    lng = 'en-US';
  }

  return i18next.getFixedT(lng, namespace);
}
