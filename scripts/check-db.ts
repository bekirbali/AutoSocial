import 'dotenv/config';
import { db } from '../src/db/index.js';
import { processedArticles, publishedTweets, rawArticles, instagramDigests } from '../src/db/schema.js';
import { desc, eq, gte } from 'drizzle-orm';

async function main() {
  console.log('--- RECENT PROCESSED ARTICLES ---');
  const list = await db
    .select({
      id: processedArticles.id,
      status: processedArticles.status,
      score: processedArticles.score,
      includedInDigest: processedArticles.includedInDigest,
      rawTitle: rawArticles.title,
      tweetText: processedArticles.tweetText,
      createdAt: processedArticles.createdAt,
    })
    .from(processedArticles)
    .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .orderBy(desc(processedArticles.createdAt))
    .limit(10);

  for (const item of list) {
    console.log(`[${item.status}] (Digest: ${item.includedInDigest}, Score: ${item.score}) Title: ${item.rawTitle.substring(0, 50)}...`);
  }

  console.log('\n--- PUBLISHED TWEETS TODAY ---');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tweets = await db
    .select({
      tweetId: publishedTweets.tweetId,
      publishedAt: publishedTweets.publishedAt,
      tweetUrl: publishedTweets.tweetUrl,
      title: rawArticles.title,
      processedId: publishedTweets.processedId,
      status: processedArticles.status,
    })
    .from(publishedTweets)
    .innerJoin(processedArticles, eq(publishedTweets.processedId, processedArticles.id))
    .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .where(gte(publishedTweets.publishedAt, today))
    .orderBy(desc(publishedTweets.publishedAt));

  console.log(`Found ${tweets.length} tweets published today:`);
  for (const t of tweets) {
    console.log(`[${t.publishedAt}] ID: ${t.processedId} - ${t.title.substring(0, 60)}`);
    if (t.processedId) {
      await db
        .update(processedArticles)
        .set({ includedInDigest: false, updatedAt: new Date() })
        .where(eq(processedArticles.id, t.processedId));
    }
  }
  console.log(`\n✅ Reset includedInDigest = false for all ${tweets.length} tweets published today.`);

  process.exit(0);
}

main().catch(console.error);
