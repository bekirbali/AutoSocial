import 'dotenv/config';
import { db } from '../src/db/index.js';
import { processedArticles, rawArticles, sources, publishedTweets } from '../src/db/schema.js';
import { eq, and, desc, gte } from 'drizzle-orm';

import { getTurkishHeadline } from '../src/modules/publisher/digestManager.js';

async function main() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  console.log('Today start:', todayStart.toISOString());

  const candidates = await db
    .select({
      id: processedArticles.id,
      tweetText: processedArticles.tweetText,
      translatedTitle: processedArticles.translatedTitle,
      category: processedArticles.category,
      score: processedArticles.score,
      status: processedArticles.status,
      createdAt: processedArticles.createdAt,
      rawTitle: rawArticles.title,
      rawImageUrl: rawArticles.imageUrl,
      rawPublishedAt: rawArticles.publishedAt,
      rawUrl: rawArticles.url,
      sourceName: sources.name,
      tweetPublishedAt: publishedTweets.publishedAt,
      tweetUrl: publishedTweets.tweetUrl,
      imagePath: processedArticles.imagePath,
    })
    .from(processedArticles)
    .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .innerJoin(publishedTweets, eq(publishedTweets.processedId, processedArticles.id))
    .leftJoin(sources, eq(rawArticles.sourceId, sources.id))
    .where(
      and(
        eq(processedArticles.status, 'published'),
        eq(processedArticles.includedInDigest, false),
        gte(publishedTweets.publishedAt, todayStart),
      ),
    )
    .orderBy(desc(publishedTweets.publishedAt))
    .limit(7);

  console.log(`\n🎯 Digest candidates found: ${candidates.length}`);
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    console.log(`\n#${i + 1}:`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Raw Title (EN): ${c.rawTitle}`);
    console.log(`  Display Title (TR): ${getTurkishHeadline(c)}`);
    console.log(`  Raw Image URL: ${c.rawImageUrl}`);
    console.log(`  Processed Image Path: ${c.imagePath}`);
    console.log(`  Raw URL: ${c.rawUrl}`);
    console.log(`  TweetPublishedAt: ${c.tweetPublishedAt}`);
    console.log(`  TweetUrl: ${c.tweetUrl}`);
  }

  process.exit(0);
}

main().catch(console.error);
