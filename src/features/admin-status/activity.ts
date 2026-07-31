import { ActivityType, type Client } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/db-client';
import { botSettings } from '../../core/db/schema';
import { logger } from '../../core/logger';

const ACTIVITY_KEY = 'activity';

/** Maximum accepted status length, matching the option constraint in status.command.ts. */
export const MAX_ACTIVITY_LENGTH = 128;

export function applyActivity(client: Client<true>, status: string): void {
  // ActivityType.Custom renders the `state` field, not `name`. Passing only a name (as the old
  // implementation did) sets a presence that displays nothing at all.
  client.user.setActivity({ name: status, state: status, type: ActivityType.Custom });
}

export async function saveActivity(status: string): Promise<void> {
  const updatedAt = new Date();
  await db
    .insert(botSettings)
    .values({ key: ACTIVITY_KEY, value: status, updatedAt })
    .onConflictDoUpdate({
      target: botSettings.key,
      set: { value: status, updatedAt },
    });
}

/** Re-applies the stored status after a restart; the presence itself is not persisted by Discord. */
export async function restoreActivity(client: Client<true>): Promise<void> {
  try {
    const saved = await db
      .select({ value: botSettings.value })
      .from(botSettings)
      .where(eq(botSettings.key, ACTIVITY_KEY))
      .get();

    if (!saved) {
      return;
    }

    applyActivity(client, saved.value);
    logger.info(`Restored the saved bot status: ${saved.value}`);
  } catch (error) {
    logger.error('Failed to restore activity, skipping:', error);
  }
}
