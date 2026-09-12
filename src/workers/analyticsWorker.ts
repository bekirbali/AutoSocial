import { Worker, type Job } from 'bullmq';
import { createLogger } from '../lib/logger.js';
import { redisConnection, QUEUE_NAMES, type AnalyticsJobData } from '../lib/queue.js';
import { refreshTweetMetrics } from '../modules/analytics/index.js';
import { flushDailyStats } from '../modules/analytics/dailyStats.js';
import { sendWeeklyReport } from '../modules/telegram/report.js';

const log = createLogger('worker:analytics');

/**
 * Analytics Worker — Tweet engagement metriklerini güncelle
 *
 * İş akışı:
 * 1. Son N saatte yayınlanan tweetlerin metriklerini X API'den çek
 * 2. published_tweets tablosunu güncelle
 * 3. daily_stats tablosunu flush et
 *
 * NOT: X Free tier'da public_metrics kısıtlı.
 * X Premium alındıktan sonra tam metrikler aktif edilecek.
 */
async function analyticsJob(job: Job<AnalyticsJobData>): Promise<void> {
  log.info(
    { jobId: job.id, lookbackHours: job.data.lookbackHours },
    '📊 Analytics job başladı',
  );

  if (job.name === 'weekly-report') {
    await sendWeeklyReport();
    log.info({ jobId: job.id }, '✅ Weekly report job tamamlandı');
    return;
  }

  if (job.name === 'noon-digest') {
    const { createDailyDigest } = await import('../modules/publisher/digestManager.js');
    await createDailyDigest('noon');
    log.info({ jobId: job.id }, '✅ Öğle bülteni (13:00) job tamamlandı');
    return;
  }

  if (job.name === 'evening-digest') {
    const { createDailyDigest } = await import('../modules/publisher/digestManager.js');
    await createDailyDigest('evening');
    log.info({ jobId: job.id }, '✅ Akşam bülteni (19:00) job tamamlandı');
    return;
  }

  try {
    // Tweet metriklerini güncelle
    const updated = await refreshTweetMetrics(job.data.lookbackHours);
    log.info({ updated }, 'Tweet metrikleri güncellendi');

    // daily_stats'ı DB'ye flush et
    await flushDailyStats();
    log.info('daily_stats flushed');
  } catch (err) {
    // Analytics hatası kritik değil — log et, throw etme
    log.warn(
      { err: err instanceof Error ? err.message : err },
      '⚠️ Analytics job kısmi hata (kritik değil)',
    );
  }

  log.info({ jobId: job.id }, '✅ Analytics job tamamlandı');
}

/**
 * Analytics Worker başlat
 */
export function startAnalyticsWorker(): Worker<AnalyticsJobData> {
  const worker = new Worker<AnalyticsJobData>(
    QUEUE_NAMES.ANALYTICS,
    analyticsJob,
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    log.debug({ jobId: job.id }, 'Analytics job completed');
  });

  worker.on('failed', (job, err) => {
    log.warn({ jobId: job?.id, err: err.message }, 'Analytics job failed (non-critical)');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Analytics worker error');
  });

  log.info('Analytics worker başlatıldı');
  return worker;
}
