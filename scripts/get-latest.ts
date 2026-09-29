import 'dotenv/config';
import { db } from '../src/db/index.js';
import { processedArticles, rawArticles } from '../src/db/schema.js';
import { desc, eq } from 'drizzle-orm';

async function main() {
  const latestList = await db
    .select({
      id: processedArticles.id,
      tweetText: processedArticles.tweetText,
      instagramCaption: processedArticles.instagramCaption,
      score: processedArticles.score,
      category: processedArticles.category,
      createdAt: processedArticles.createdAt,
      status: processedArticles.status,
      rawTitle: rawArticles.title,
      rawUrl: rawArticles.url,
      imageUrl: processedArticles.imagePath,
    })
    .from(processedArticles)
    .leftJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .orderBy(desc(processedArticles.createdAt))
    .limit(3);

  console.log(JSON.stringify(latestList, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
