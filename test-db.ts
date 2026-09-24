import { db } from './src/db/index.js';
import { processedArticles } from './src/db/schema.js';
import { desc } from 'drizzle-orm';

async function get() {
  const res = await db.select({
    id: processedArticles.id,
    imagePath: processedArticles.imagePath,
    updatedAt: processedArticles.updatedAt,
    status: processedArticles.status,
  }).from(processedArticles).orderBy(desc(processedArticles.updatedAt)).limit(5);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}
get();




