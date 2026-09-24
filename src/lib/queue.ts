import { Queue } from 'bullmq';
import { redis } from './redis.js';

/**
 * AutoSocial — BullMQ Queue Tanımları
 *
 * 4 kuyruk:
 *   fetch-queue    → RSS çekme işleri (cron ile tetiklenir)
 *   process-queue  → Makale işleme işleri (fetch-worker tarafından eklenir)
 *   publish-queue  → Delayed tweet yayın işleri (process-worker tarafından eklenir)
 *   analytics-queue → Engagement metrik güncelleme işleri (cron ile tetiklenir)
 */

// BullMQ için Redis connection options
// ioredis instance'ını doğrudan kullanamıyoruz, connection config lazım
export const redisConnection = {
  host: parseRedisHost(),
  port: parseRedisPort(),
  password: parseRedisPassword(),
};

function parseRedisHost(): string {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  try {
    return new URL(url).hostname;
  } catch {
    return 'localhost';
  }
}

function parseRedisPort(): number {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  try {
    return parseInt(new URL(url).port || '6379', 10);
  } catch {
    return 6379;
  }
}

function parseRedisPassword(): string | undefined {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  try {
    const password = new URL(url).password;
    return password || undefined;
  } catch {
    return undefined;
  }
}

// ─── Queue İsimleri (sabit, typo'ya karşı) ───────────────────────────────────
export const QUEUE_NAMES = {
  FETCH: 'fetch-queue',
  PROCESS: 'process-queue',
  PUBLISH: 'publish-queue',
  ANALYTICS: 'analytics-queue',
} as const;

// ─── Job Veri Tipleri ──────────────────────────────────────────────────────────

export interface FetchJobData {
  triggeredBy: 'cron' | 'manual';
  timestamp: number;
}

export interface ProcessJobData {
  url: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  publishedAt: string; // ISO string
  sourceId: string;
  sourceName: string;
  lang: string;
}

export interface PublishJobData {
  processedArticleId: string;
  scheduledFor: string; // ISO string — delayed job için
}

export interface AnalyticsJobData {
  triggeredBy: 'cron' | 'manual';
  lookbackHours: number;
}

// ─── Queue Instance'ları ──────────────────────────────────────────────────────

export const fetchQueue = new Queue<FetchJobData>(QUEUE_NAMES.FETCH, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },  // Son 100 başarılı job'ı tut
    removeOnFail: { count: 200 },      // Son 200 başarısız job'ı tut
  },
});

export const processQueue = new Queue<ProcessJobData>(QUEUE_NAMES.PROCESS, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

export const publishQueue = new Queue<PublishJobData>(QUEUE_NAMES.PUBLISH, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
});

export const analyticsQueue = new Queue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

/**
 * Belirli bir makaleye ait kuyrukta bekleyen (delayed veya waiting) tüm publish işlerini temizler
 */
export async function removePendingPublishJobs(articleId: string): Promise<number> {
  let removedCount = 0;
  try {
    const jobs = await publishQueue.getJobs(['delayed', 'waiting']);
    for (const job of jobs) {
      const matchData = (job.data as PublishJobData)?.processedArticleId === articleId;
      const matchName = job.name === `publish:${articleId}`;
      const matchId = job.id ? job.id.includes(articleId) : false;
      if (matchData || matchName || matchId) {
        await job.remove().catch(() => {});
        removedCount++;
      }
    }
  } catch (err) {
    // Sessizce geç veya logla
  }
  return removedCount;
}

/**
 * Tüm queue'lara graceful close gönder
 */
export async function closeQueues(): Promise<void> {
  await Promise.allSettled([
    fetchQueue.close(),
    processQueue.close(),
    publishQueue.close(),
    analyticsQueue.close(),
  ]);
}

