import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Only the drizzle-kit CLI needs this: the bot itself runs under Bun, which loads `.env` on its own.
dotenv.config();

export default defineConfig({
  schema: './src/core/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'sqlite.db',
  },
});
