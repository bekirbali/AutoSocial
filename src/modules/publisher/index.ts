import { db } from '../../db/index.js';
import { processedArticles, publishedTweets } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createLogger } from '../../lib/logger.js';
import { postTweet, postReply } from './twitter.js';
import { withRateLimit } from './rateLimiter.js';
import { getNextApprovedArticle, getNextPublishTime } from './scheduler.js';

const log = createLogger('publisher');

/**
 * Onaylanmış bir sonraki haberi yayınla
 * Rate limit kontrolü → tweet at → ilk yoruma link ekle → DB güncelle
 */
export async function publishNext(): Promise<boolean> {
  // Rate limit ve günlük limit kontrolü
  const { canPublish, reason } = await getNextPublishTime();
  if (!canPublish) {
    log.info({ reason }, 'Şu an yayın yapılamıyor');
    return false;
  }

  // Onaylanmış makale var mı?
  const article = await getNextApprovedArticle();
  if (!article) {
    log.debug('Yayına hazır makale yok');
    return false;
  }

  const articleUrl = article.articleUrl;

  try {
    // Durumu 'queued' olarak işaretle
    await db
      .update(processedArticles)
      .set({ status: 'queued', updatedAt: new Date() })
      .where(eq(processedArticles.id, article.id));

    // Tweet at
    const { tweetId, tweetUrl } = await withRateLimit(() =>
      postTweet(
        article.tweetText,
        (article.hashtags as string[]) ?? [],
        article.imagePath ?? undefined,
      ),
    );

    // İlk yoruma kaynak linki ekle (X algoritması link içeren tweetleri bastırıyor)
    let replyTweetId: string | undefined;
    if (articleUrl) {
      try {
        const replyResult = await withRateLimit(() =>
          postReply(tweetId, `🔗 Kaynak: ${articleUrl}`),
        );
        replyTweetId = replyResult.tweetId;
      } catch (replyErr) {
        log.warn(
          { err: replyErr instanceof Error ? replyErr.message : replyErr },
          'Link yorumu eklenemedi',
        );
      }
    }

    // published_tweets tablosuna kaydet
    await db.insert(publishedTweets).values({
      processedId: article.id,
      tweetId,
      tweetUrl,
      replyTweetId,
    });

    // processed_articles durumunu güncelle
    await db
      .update(processedArticles)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(processedArticles.id, article.id));

    log.info({ tweetId, tweetUrl, articleId: article.id }, '🐦 Tweet yayınlandı');
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    log.error({ err: errMsg, articleId: article.id }, 'Tweet yayınlama başarısız');

    // Durumu 'failed' olarak güncelle
    await db
      .update(processedArticles)
      .set({
        status: 'failed',
        rejectionReason: errMsg.substring(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(processedArticles.id, article.id));

    return false;
  }
}
