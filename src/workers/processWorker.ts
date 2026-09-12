import { Worker, type Job } from 'bullmq';
import { createLogger } from '../lib/logger.js';
import {
  redisConnection,
  publishQueue,
  QUEUE_NAMES,
  type ProcessJobData,
  type PublishJobData,
} from '../lib/queue.js';
import { processArticle } from '../modules/processor/index.js';
import { getNextPublishSlot } from '../scheduler/cron.js';
import { updateDailyStats } from '../modules/analytics/dailyStats.js';
import type { FetchedItem } from '../modules/fetcher/rss.js';
import { sendApprovalRequest } from '../modules/telegram/bot.js';
import { db } from '../db/index.js';
import { processedArticles } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const log = createLogger('worker:process');

/**
 * Process Worker — Haberleri AI ile işle ve publish-queue'ya ekle
 *
 * İş akışı:
 * 1. ProcessJobData'yı FetchedItem'a dönüştür
 * 2. processArticle() pipeline'ını çalıştır (dedup → score → AI → image → DB)
 * 3. Başarılıysa günlük plana göre delayed publish job ekle
 */
async function processJob(job: Job<ProcessJobData>): Promise<void> {
  const { url, title } = job.data;
  log.info({ jobId: job.id, title: title.substring(0, 60) }, '⚙️ Process job başladı');

  // ProcessJobData → FetchedItem dönüşümü
  const item: FetchedItem = {
    url: job.data.url,
    title: job.data.title,
    summary: job.data.summary,
    imageUrl: job.data.imageUrl,
    videoUrl: job.data.videoUrl,
    mediaType: job.data.mediaType,
    publishedAt: new Date(job.data.publishedAt),
    sourceId: job.data.sourceId,
    sourceName: job.data.sourceName,
    lang: job.data.lang,
  };

  const result = await processArticle(item);

  // İstatistikleri güncelle
  switch (result.status) {
    case 'processed':
      await updateDailyStats({ articlesProcessed: 1 });
      break;
    case 'duplicate':
    case 'filtered':
    case 'low_score':
      await updateDailyStats({ articlesRejected: 1 });
      break;
    case 'failed':
      throw new Error(`Makale işleme başarısız: ${result.reason}`);
  }

  // Başarıyla işlendiyse duruma göre işlem yap
  if (result.status === 'processed' && result.processedArticleId) {
    if (result.dbStatus === 'pending') {
      // Telegram onayına gönder
      const articleData = await db.query.processedArticles.findFirst({
        where: eq(processedArticles.id, result.processedArticleId),
      });

      if (articleData) {
        await sendApprovalRequest({
          articleId: result.processedArticleId,
          tweetText: articleData.tweetText,
          score: Number(articleData.score),
          imagePath: articleData.imagePath ?? undefined,
          sourceUrl: item.url,
          category: articleData.category ?? 'Genel',
          threadTweets: (articleData.threadTweets as string[]) ?? undefined,
          hasReelVideo: !!articleData.videoPath,
          instagramCaption: articleData.instagramCaption ?? undefined,
        });
        log.info({ processedId: result.processedArticleId }, '📲 Telegram onayı istendi');
      }
    } else {
      // Doğrudan publish-queue'ya delayed job ekle (automatic mod)
      const publishAt = await getNextPublishSlot();
      const delayMs = Math.max(0, publishAt.getTime() - Date.now());

      const publishJobData: PublishJobData = {
        processedArticleId: result.processedArticleId,
        scheduledFor: publishAt.toISOString(),
      };

      await publishQueue.add(
        `publish:${result.processedArticleId}`,
        publishJobData,
        { delay: delayMs },
      );

      log.info(
        {
          processedId: result.processedArticleId,
          scheduledFor: publishAt.toISOString(),
          delayMin: Math.round(delayMs / 60000),
        },
        '📅 Publish job zamanlandı',
      );
    }
  }

  log.info({ jobId: job.id, url, status: result.status }, '✅ Process job tamamlandı');
}

/**
 * Process Worker başlat
 * concurrency=1: Gemini free tier için seri işleme (rate limit)
 */
export function startProcessWorker(): Worker<ProcessJobData> {
  const worker = new Worker<ProcessJobData>(
    QUEUE_NAMES.PROCESS,
    processJob,
    {
      connection: redisConnection,
      concurrency: 1, // Gemini free tier — paralel istek yok
      limiter: {
        max: 1,
        duration: 4000, // 4 saniyede max 1 job (Gemini rate limit için ek güvence)
      },
    },
  );

  worker.on('completed', (job) => {
    log.debug({ jobId: job.id }, 'Process job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, '❌ Process job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Process worker error');
  });

  log.info('Process worker başlatıldı (concurrency=1, Gemini rate limit güvenceli)');
  return worker;
}
