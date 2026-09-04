import { Worker, type Job } from 'bullmq';
import { createLogger } from '../lib/logger.js';
import { redisConnection, QUEUE_NAMES, type PublishJobData } from '../lib/queue.js';
import { db } from '../db/index.js';
import { processedArticles, publishedTweets, publishedInstagramPosts, rawArticles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { postTweet, postReply } from '../modules/publisher/twitter.js';
import { postToInstagram } from '../modules/publisher/instagram.js';
import { withRateLimit } from '../modules/publisher/rateLimiter.js';
import { getTodayPublishedCount } from '../modules/publisher/scheduler.js';
import { updateDailyStats } from '../modules/analytics/dailyStats.js';
import { env } from '../config/env.js';

const log = createLogger('worker:publish');

/**
 * Publish Worker — Delayed job gelince tweet at
 *
 * İş akışı:
 * 1. Günlük limit kontrolü
 * 2. APP_MODE kontrolü (hybrid modda Telegram onayı Faz 3'e kadar atla)
 * 3. Tweet at + görsel
 * 4. İlk yoruma kaynak linki
 * 5. DB güncelle
 */
async function publishJob(job: Job<PublishJobData>): Promise<void> {
  const { processedArticleId, scheduledFor } = job.data;
  log.info({ jobId: job.id, processedArticleId, scheduledFor }, '🐦 Publish job başladı');

  // ─── Günlük Limit Kontrolü ────────────────────────────────────────────────
  const todayCount = await getTodayPublishedCount();
  if (todayCount >= env.MAX_TWEETS_PER_DAY) {
    log.warn({ todayCount, limit: env.MAX_TWEETS_PER_DAY }, 'Günlük tweet limiti doldu, atlanıyor');
    return;
  }

  // ─── Makaleyi DB'den Çek ──────────────────────────────────────────────────
  const results = await db
    .select({
      id: processedArticles.id,
      tweetText: processedArticles.tweetText,
      hashtags: processedArticles.hashtags,
      threadTweets: processedArticles.threadTweets,
      instagramCaption: processedArticles.instagramCaption,
      platformTargets: processedArticles.platformTargets,
      imagePath: processedArticles.imagePath,
      videoPath: processedArticles.videoPath,
      status: processedArticles.status,
      articleUrl: rawArticles.url,
    })
    .from(processedArticles)
    .leftJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .where(eq(processedArticles.id, processedArticleId))
    .limit(1);

  const article = results[0];

  if (!article) {
    log.warn({ processedArticleId }, 'Makale bulunamadı, job iptal');
    return;
  }

  // Zaten yayınlandı veya reddedildiyse atla
  if (article.status === 'published' || article.status === 'rejected') {
    log.info({ processedArticleId, status: article.status }, 'Makale zaten işlendi, atlanıyor');
    return;
  }

  // Hybrid modda: 'pending' durumundakileri Faz 3'e kadar yayınla
  // (Faz 3'te Telegram onayı buraya entegre edilecek)
  if (article.status === 'pending' && env.APP_MODE === 'hybrid') {
    log.info({ processedArticleId }, 'Hybrid mod: Telegram onayı bekleniyor (Faz 3 sonrası aktif)');
    // Şimdilik hybrid modda da yayınla — Faz 3'te bu satır değişecek
  }

  // ─── Tweet Yayını ─────────────────────────────────────────────────────────
  try {
    // Durumu 'queued' olarak işaretle
    await db
      .update(processedArticles)
      .set({ status: 'queued', updatedAt: new Date() })
      .where(eq(processedArticles.id, article.id));

    // Hedef platformları kontrol et (Eğer belirtilmemişse varsayılan 'x' kabul et)
    const targets = article.platformTargets || ['x'];

    // ─── Twitter (X) Yayını ───
    if (targets.includes('x')) {
      const existingTweet = await db.query.publishedTweets.findFirst({
        where: eq(publishedTweets.processedId, article.id)
      });

      if (existingTweet) {
        log.info({ processedArticleId }, 'X (Twitter) için zaten yayınlanmış, atlanıyor.');
      } else {
        let currentTweetId: string;

        const { tweetId, tweetUrl } = await withRateLimit(() =>
          postTweet(
            article.tweetText,
            (article.hashtags as string[]) ?? [],
            article.videoPath ?? article.imagePath ?? undefined,
          ),
        );
        currentTweetId = tweetId;

        // Eğer thread ise diğer tweetleri reply olarak at
        // TODO: (Faz 1-3) 15 tweet/gün limitine takılmamak için thread özelliği şimdilik askıya alındı
        /*
        const threadTweets = article.threadTweets as string[] | null;
        if (threadTweets && Array.isArray(threadTweets) && threadTweets.length > 0) {
          log.info({ tweetId, threadLength: threadTweets.length }, 'Thread tweetleri atılıyor');
          for (const threadText of threadTweets) {
            try {
              const replyResult = await withRateLimit(() => postReply(currentTweetId, threadText));
              currentTweetId = replyResult.tweetId;
            } catch (threadErr) {
              log.error({ err: threadErr instanceof Error ? threadErr.message : threadErr }, 'Thread parçası atılamadı, işlem kesiliyor');
              throw threadErr;
            }
          }
        }
        */

        // Thread'in en sonuna (veya tek tweetse ilkine) kaynak linki
        // TODO: (Faz 1-3) 15 tweet/gün limitine takılmamak için yorum olarak link atma kapatıldı
        let replyTweetId: string | undefined;
        /*
        if (article.articleUrl) {
          try {
            const replyResult = await withRateLimit(() =>
              postReply(currentTweetId, `🔗 Kaynak: ${article.articleUrl}`),
            );
            replyTweetId = replyResult.tweetId;
          } catch (replyErr) {
            log.warn(
              { err: replyErr instanceof Error ? replyErr.message : replyErr },
              'Link yorumu eklenemedi (kritik değil)',
            );
          }
        }
        */

        // published_tweets tablosuna kaydet
        await db.insert(publishedTweets).values({
          processedId: article.id,
          tweetId,
          tweetUrl,
          replyTweetId,
        });
        log.info({ tweetId, tweetUrl, processedArticleId }, '✅ Tweet yayınlandı');
      }
    }

    // ─── Instagram Yayını ───
    if (targets.includes('instagram')) {
      const existingIg = await db.query.publishedInstagramPosts.findFirst({
        where: eq(publishedInstagramPosts.processedId, article.id)
      });

      if (existingIg) {
        log.info({ processedArticleId }, 'Instagram için zaten yayınlanmış, atlanıyor.');
      } else {
        if (!article.imagePath && !article.videoPath) {
          throw new Error('Instagram yayını için görsel veya video zorunludur');
        }

        const caption = article.instagramCaption || article.tweetText;
        const igResult = await postToInstagram(
          caption,
          (article.hashtags as string[]) ?? [],
          (article.videoPath ?? article.imagePath) as string
        );

        // published_instagram_posts tablosuna kaydet
        await db.insert(publishedInstagramPosts).values({
          processedId: article.id,
          igMediaId: igResult.igMediaId,
          igPostUrl: igResult.igPostUrl,
        });
        log.info({ igMediaId: igResult.igMediaId, processedArticleId }, '✅ Instagram gönderisi yayınlandı');
      }
    }

    // Durumu 'published' olarak güncelle
    await db
      .update(processedArticles)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(processedArticles.id, article.id));

    await updateDailyStats({ articlesPublished: 1 });

    log.info({ processedArticleId }, '✅ Makale yayınlama tamamlandı');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ err: errMsg, processedArticleId }, '❌ Makale yayınlama başarısız');

    // Durumu 'failed' olarak işaretle
    await db
      .update(processedArticles)
      .set({
        status: 'failed',
        rejectionReason: errMsg.substring(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(processedArticles.id, article.id))
      .catch(() => {});

    throw error; // BullMQ'nun retry mekanizması devreye girsin
  }
}

/**
 * Publish Worker başlat
 * concurrency=1: Tweet'ler sırayla gönderilmeli (rate limit + bot tespiti)
 */
export function startPublishWorker(): Worker<PublishJobData> {
  const worker = new Worker<PublishJobData>(
    QUEUE_NAMES.PUBLISH,
    publishJob,
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    log.info({ jobId: job.id }, '✅ Publish job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, '❌ Publish job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Publish worker error');
  });

  log.info('Publish worker başlatıldı');
  return worker;
}
