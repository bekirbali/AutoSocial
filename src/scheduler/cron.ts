import { createLogger } from '../lib/logger.js';
import {
  fetchQueue,
  analyticsQueue,
  publishQueue,
  type FetchJobData,
  type AnalyticsJobData,
  type PublishJobData,
} from '../lib/queue.js';
import { generateDailySchedule, getTodayPublishedCount } from '../modules/publisher/scheduler.js';
import { cleanupOldVideos } from './cleanup.js';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { processedArticles } from '../db/schema.js';
import { eq, and, gte } from 'drizzle-orm';

const log = createLogger('scheduler:cron');

// ─── Cron İfadeleri ───────────────────────────────────────────────────────────

// Her FETCH_INTERVAL_MINUTES dakikada bir RSS çek
function fetchCronExpression(): string {
  const interval = env.FETCH_INTERVAL_MINUTES;
  // BullMQ cron format: "*/15 * * * *"
  return `*/${interval} * * * *`;
}

// Her sabah 06:30'da günlük yayın planı oluştur
const DAILY_PLAN_CRON = '30 6 * * *';

// Her Pazar sabah 10:00'da haftalık rapor (Telegram)
const WEEKLY_REPORT_CRON = '0 10 * * 0';

// Her ANALYTICS_FETCH_INTERVAL_HOURS saatte bir analytics
function analyticsCronExpression(): string {
  const interval = env.ANALYTICS_FETCH_INTERVAL_HOURS;
  return `0 */${interval} * * *`;
}

// Instagram Günlük Toplu Haber Bültenleri (Reels Digest)
const NOON_DIGEST_CRON = '0 13 * * *'; // Her gün 13:00
const EVENING_DIGEST_CRON = '0 19 * * *'; // Her gün 19:00

/**
 * Tüm recurring (tekrar eden) job'ları BullMQ'ya kayıt et
 * Bu fonksiyon sadece bir kez (boot'ta) çağrılır.
 */
export async function registerCronJobs(): Promise<void> {
  log.info('Cron job\'lar kaydediliyor...');

  // ─── 1. RSS Fetch Cron ────────────────────────────────────────────────────
  await fetchQueue.add(
    'fetch-cron',
    { triggeredBy: 'cron', timestamp: Date.now() } satisfies FetchJobData,
    {
      repeat: { pattern: fetchCronExpression() },
    },
  );
  log.info({ cron: fetchCronExpression() }, '✅ RSS fetch cron kaydedildi');

  // ─── 2. Günlük Yayın Planı Cron ──────────────────────────────────────────
  await fetchQueue.add(
    'daily-plan-cron',
    { triggeredBy: 'cron', timestamp: Date.now() } satisfies FetchJobData,
    {
      repeat: { pattern: DAILY_PLAN_CRON },
    },
  );
  // Not: daily plan ayrı bir queue değil — schedulePublishJobs() cron.ts içinde çağrılıyor
  log.info({ cron: DAILY_PLAN_CRON }, '✅ Günlük plan cron kaydedildi');

  // ─── 3. Analytics Cron ────────────────────────────────────────────────────
  await analyticsQueue.add(
    'analytics-cron',
    {
      triggeredBy: 'cron',
      lookbackHours: env.ANALYTICS_FETCH_INTERVAL_HOURS * 2,
    } satisfies AnalyticsJobData,
    {
      repeat: { pattern: analyticsCronExpression() },
    },
  );
  log.info({ cron: analyticsCronExpression() }, '✅ Analytics cron kaydedildi');

  // ─── 4. Haftalık Rapor Cron ───────────────────────────────────────────────
  await analyticsQueue.add(
    'weekly-report',
    {
      triggeredBy: 'cron',
      lookbackHours: 0, // Bu job rapor gönderir, lookback kullanmaz
    } satisfies AnalyticsJobData,
    {
      repeat: { pattern: WEEKLY_REPORT_CRON },
    },
  );
  log.info({ cron: WEEKLY_REPORT_CRON }, '✅ Haftalık rapor cron kaydedildi');

  // ─── 5. Instagram Günlük Bülten Cron'ları (13:00 ve 19:00) ─────────────────
  if (env.ENABLE_INSTAGRAM) {
    await analyticsQueue.add(
      'noon-digest',
      {
        triggeredBy: 'cron',
        lookbackHours: 0,
      } satisfies AnalyticsJobData,
      {
        repeat: { pattern: NOON_DIGEST_CRON },
      },
    );
    log.info({ cron: NOON_DIGEST_CRON }, '✅ Öğle bülteni (13:00) cron kaydedildi');

    await analyticsQueue.add(
      'evening-digest',
      {
        triggeredBy: 'cron',
        lookbackHours: 0,
      } satisfies AnalyticsJobData,
      {
        repeat: { pattern: EVENING_DIGEST_CRON },
      },
    );
    log.info({ cron: EVENING_DIGEST_CRON }, '✅ Akşam bülteni (19:00) cron kaydedildi');
  }

  log.info('Tüm cron job\'lar kaydedildi');
}

/**
 * Bugün için publish job'larını zamanla
 * Her sabah 06:30'da + sistem başlarken çağrılır
 *
 * Onaylanmış (pending/approved) makaleleri alır,
 * günlük plan zamanlarına delayed job olarak ekler.
 */
export async function schedulePublishJobs(): Promise<void> {
  // Eski videoları temizle (24 saatten eski olanlar)
  await cleanupOldVideos().catch(e => log.error({ err: e.message }, 'Cleanup hatası'));

  const schedule = generateDailySchedule();
  const todayCount = await getTodayPublishedCount();

  if (todayCount >= env.MAX_TWEETS_PER_DAY) {
    log.info({ todayCount }, 'Günlük limit dolu, publish job zamanlanmıyor');
    return;
  }

  const remainingSlots = schedule.slice(todayCount);

  // Henüz zamanlanmamış onaylı makaleleri çek
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingArticles = await db
    .select({ id: processedArticles.id })
    .from(processedArticles)
    .where(
      and(
        eq(processedArticles.status, 'approved'),
        gte(processedArticles.createdAt, today),
      ),
    )
    .orderBy(processedArticles.createdAt)
    .limit(remainingSlots.length);

  let scheduled = 0;
  for (let i = 0; i < pendingArticles.length && i < remainingSlots.length; i++) {
    const article = pendingArticles[i]!;
    const publishAt = remainingSlots[i]!;
    const delayMs = Math.max(0, publishAt.getTime() - Date.now());

    const jobData: PublishJobData = {
      processedArticleId: article.id,
      scheduledFor: publishAt.toISOString(),
    };

    await publishQueue.add(`publish:${article.id}`, jobData, {
      delay: delayMs,
      jobId: `publish-${article.id}`, // Aynı makale için duplicate job önle
    });

    scheduled++;
  }

  log.info(
    { scheduled, availableSlots: remainingSlots.length, pendingArticles: pendingArticles.length },
    '📅 Günlük publish planı hazır',
  );
}

/**
 * Bir sonraki boş publish slotunu döndür
 * processWorker tarafından her yeni işlenen makale için kullanılır
 */
export async function getNextPublishSlot(): Promise<Date> {
  const schedule = generateDailySchedule();
  const todayCount = await getTodayPublishedCount();
  
  // Kuyruktaki delayed (bekleyen) işleri al
  const delayedJobs = await publishQueue.getDelayed();
  
  // Bugün için planlanmış olanların sayısını ve kuyruktaki EN İLERİ zamanı bul
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let queuedForTodayCount = 0;
  let lastScheduledTime = 0;

  for (const job of delayedJobs) {
    if (job.data && job.data.scheduledFor) {
      const scheduledTime = new Date(job.data.scheduledFor).getTime();
      if (scheduledTime >= todayStart.getTime() && scheduledTime < todayEnd.getTime()) {
        queuedForTodayCount++;
      }
      if (scheduledTime > lastScheduledTime) {
        lastScheduledTime = scheduledTime;
      }
    }
  }

  const totalToday = todayCount + queuedForTodayCount;
  let proposedSlot: Date | null = null;

  // Bugünkü planın dolmamış ve gelecekte olan ilk slotunu bul
  for (let i = totalToday; i < schedule.length; i++) {
    const slot = schedule[i];
    if (slot && slot.getTime() > Date.now()) {
      proposedSlot = slot;
      break;
    }
  }

  // Plan doldu veya geçmiş saatte — yarın sabah 07:00'a ata
  if (!proposedSlot) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);

    const jitter = (Math.random() * 24 - 12) * 60 * 1000;
    proposedSlot = new Date(tomorrow.getTime() + jitter);
  }

  // Çarpışma Önleme (Collision & Min Interval)
  // Eğer önerilen zaman (proposedSlot), sıradaki en son hedeften en az 30 dk sonra değilse, onu ileri it.
  const minIntervalMs = 30 * 60 * 1000; // 30 dakika
  const minimumAllowedTime = Math.max(Date.now(), lastScheduledTime) + minIntervalMs;

  if (proposedSlot.getTime() < minimumAllowedTime) {
    // Biraz jitter ekleyerek aynı düz saatlere (örn: 07:30, 08:00) yığılmasını engelle
    const jitter = (Math.random() * 10 - 5) * 60 * 1000; // ±5 dk
    return new Date(minimumAllowedTime + jitter);
  }

  return proposedSlot;
}

/**
 * İlk başlatmada bekleyen approved makaleleri hemen zamanla
 */
export async function bootstrapPublishQueue(): Promise<void> {
  log.info('Publish queue bootstrap başlıyor...');
  await schedulePublishJobs();
}
