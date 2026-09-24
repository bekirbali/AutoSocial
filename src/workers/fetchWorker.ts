import { Worker, type Job } from 'bullmq';
import { createLogger } from '../lib/logger.js';
import { redisConnection, processQueue, QUEUE_NAMES, type FetchJobData, type ProcessJobData } from '../lib/queue.js';
import { fetchAllSources } from '../modules/fetcher/index.js';
import { isDuplicate, markAsProcessed } from '../modules/processor/dedup.js';
import { filterArticle } from '../modules/processor/filter.js';
import { updateDailyStats } from '../modules/analytics/dailyStats.js';

const log = createLogger('worker:fetch');

/**
 * Fetch Worker — RSS kaynaklarından haberleri çek
 *
 * İş akışı:
 * 1. Tüm aktif kaynaklardan RSS çek
 * 2. Her item için hızlı duplicate + filtre ön kontrolü yap
 * 3. Geçen haberleri process-queue'ya job olarak ekle
 */
async function processFetchJob(job: Job<FetchJobData>): Promise<void> {
  log.info({ jobId: job.id, triggeredBy: job.data.triggeredBy }, '📥 Fetch job başladı');

  const fetchedItems = await fetchAllSources();
  log.info({ count: fetchedItems.length }, 'RSS haberleri çekildi');

  await updateDailyStats({ articlesFetched: fetchedItems.length });

  let queued = 0;
  let skipped = 0;

  for (const item of fetchedItems) {
    // Hızlı duplicate ön kontrolü (process-queue'ya gitmeden önce)
    const duplicate = await isDuplicate(item.url).catch(() => false);
    if (duplicate) {
      skipped++;
      continue;
    }

    // Hızlı filtre ön kontrolü
    const filterResult = filterArticle(item);
    if (!filterResult.passed) {
      await markAsProcessed(item.url).catch(() => {});
      skipped++;
      continue;
    }

    // process-queue'ya job ekle
    const jobData: ProcessJobData = {
      url: item.url,
      title: item.title,
      summary: item.summary,
      imageUrl: item.imageUrl ?? undefined,
      videoUrl: item.videoUrl ?? undefined,
      mediaType: item.mediaType ?? 'image',
      publishedAt: item.publishedAt.toISOString(),
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      lang: item.lang,
    };

    await processQueue.add(`process:${item.url.slice(-40)}`, jobData, {
      // Gemini rate limit için istekler arası 2sn gecikme
      delay: queued * 2000,
    });

    queued++;
  }

  log.info({ total: fetchedItems.length, queued, skipped }, '✅ Fetch job tamamlandı');
}

/**
 * Fetch Worker başlat
 */
export function startFetchWorker(): Worker<FetchJobData> {
  const worker = new Worker<FetchJobData>(
    QUEUE_NAMES.FETCH,
    processFetchJob,
    {
      connection: redisConnection,
      concurrency: 1, // Fetch işi zaten içeride paralel yapıyor
    },
  );

  worker.on('completed', (job) => {
    log.info({ jobId: job.id }, '✅ Fetch job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, '❌ Fetch job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Fetch worker error');
  });

  log.info('Fetch worker başlatıldı');
  return worker;
}
