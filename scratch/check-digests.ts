import { db } from '../src/db/index.js';
import { instagramDigests } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

async function main() {
  const res = await db.select().from(instagramDigests).orderBy(desc(instagramDigests.createdAt)).limit(5);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch(console.error);
