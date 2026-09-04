import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '../src/lib/logger.js';

const log = createLogger('migrate-manual');

async function main() {
  log.info('Running manual DB migration...');
  
  try {
    await db.execute(sql`ALTER TABLE "processed_articles" ADD COLUMN "video_path" text;`);
    log.info('Added video_path');
  } catch(e) {}
  
  try {
    await db.execute(sql`ALTER TABLE "raw_articles" ADD COLUMN "video_url" text;`);
    log.info('Added video_url');
  } catch(e) {}
  
  try {
    await db.execute(sql`ALTER TABLE "raw_articles" ADD COLUMN "media_type" text DEFAULT 'image' NOT NULL;`);
    log.info('Added media_type');
  } catch(e) {}
  
  log.info('Done.');
  process.exit(0);
}

main();
