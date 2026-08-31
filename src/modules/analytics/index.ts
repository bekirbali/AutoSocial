import { createLogger } from '../../lib/logger.js';
import { db } from '../../db/index.js';
import { publishedTweets } from '../../db/schema.js';
import { gte, and, isNull } from 'drizzle-orm';
import { twitterReadClient } from '../publisher/twitter.js';

const log = createLogger('analytics');

/**
 * Son N saatte yayınlanmış tweetlerin engagement metriklerini X API'dan çek
 *
 * X Free tier notu:
 * - `tweet.read` scope'u var → tweet çekebiliyoruz
 * - `public_metrics` (likes, retweets, impressions) → elevated access gerekebilir
 * - Şimdilik graceful fallback: metrikler alınamazsa eski değerler korunur
 *
 * X Premium alındıktan sonra bu fonksiyon tam aktif olacak.
 */
export async function refreshTweetMetrics(lookbackHours: number): Promise<number> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Son N saatte yayınlanan ve henüz analytics güncellenmemiş tweetleri çek
  const tweets = await db
    .select({
      id: publishedTweets.id,
      tweetId: publishedTweets.tweetId,
      lastAnalyticsAt: publishedTweets.lastAnalyticsAt,
    })
    .from(publishedTweets)
    .where(
      and(
        gte(publishedTweets.publishedAt, since),
      ),
    )
    .limit(50) // X API rate limit için batch boyutu
    .catch(() => []);

  if (tweets.length === 0) {
    log.debug('Analytics için yeni tweet bulunamadı');
    return 0;
  }

  log.info({ count: tweets.length }, 'Tweet metrikleri güncelleniyor');

  let updated = 0;

  for (const tweet of tweets) {
    try {
      // X API v2 ile tweet metrikleri çek
      const response = await twitterReadClient.v2.singleTweet(tweet.tweetId, {
        'tweet.fields': ['public_metrics', 'non_public_metrics'],
      });

      const metrics = response.data.public_metrics;
      if (!metrics) {
        log.debug({ tweetId: tweet.tweetId }, 'public_metrics mevcut değil (Free tier kısıtı)');
        continue;
      }

      // DB'yi güncelle
      await db
        .update(publishedTweets)
        .set({
          likes: metrics.like_count ?? 0,
          retweets: metrics.retweet_count ?? 0,
          replies: metrics.reply_count ?? 0,
          bookmarks: metrics.bookmark_count ?? 0,
          impressions: metrics.impression_count ?? 0,
          lastAnalyticsAt: new Date(),
        })
        .where(
          gte(publishedTweets.publishedAt, since),
        );

      updated++;

      // X API rate limit — tweet başına 100ms bekleme
      await sleep(100);
    } catch (err) {
      // Metrik alınamazsa log et ve devam et (kritik değil)
      log.debug(
        { tweetId: tweet.tweetId, err: err instanceof Error ? err.message : err },
        'Tweet metriği alınamadı (atlanıyor)',
      );
    }
  }

  log.info({ attempted: tweets.length, updated }, 'Tweet metrikleri güncelleme tamamlandı');
  return updated;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
