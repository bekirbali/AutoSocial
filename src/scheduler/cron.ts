import { createLogger } from '../lib/logger.js';
import {
  fetchQueue,
  analyticsQueue,
  publishQueue,
  type FetchJobData,
  type AnalyticsJobData,
  type PublishJobData,
} from '../lib/queue.js';
import {
  generateDailySchedule,
  getTodayPublishedCount,
  getTurkeyDayBounds,
} from '../modules/publisher/scheduler.js';
import { cleanupOldMedia } from './cleanup.js';
import { getDynamicSetting } from '../lib/settings.js';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { processedArticles, publishedTweets } from '../db/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';

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

// Instagram Günlük TeknoFiltre Reels Özeti (Günün Raporu)
const DAILY_DIGEST_CRON = '0 19 * * *'; // Her gün 19:00

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

  // ─── 5. Instagram Günlük Bülten Cron'u (TeknoFiltre Günün Raporu - 19:00) ───
  if (env.ENABLE_INSTAGRAM) {
    await analyticsQueue.add(
      'daily-digest',
      {
        triggeredBy: 'cron',
        lookbackHours: 0,
      } satisfies AnalyticsJobData,
      {
        repeat: { pattern: DAILY_DIGEST_CRON },
      },
    );
    log.info({ cron: DAILY_DIGEST_CRON }, '✅ Günün Raporu (19:00) cron kaydedildi');
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
  // 7 günden eski medya dosyalarını (görsel ve video) temizle
  await cleanupOldMedia(7).catch(e => log.error({ err: e.message }, 'Cleanup hatası'));

  const maxTweets = await getDynamicSetting('max_tweets_per_day', env.MAX_TWEETS_PER_DAY);
  const todayCount = await getTodayPublishedCount();

  if (todayCount >= maxTweets) {
    log.info({ todayCount, maxTweets }, 'Günlük limit dolu, publish job zamanlanmıyor');
    return;
  }

  const remainingQuota = maxTweets - todayCount;

  // Henüz zamanlanmamış onaylı makaleleri çek (Bugün Türkiye saatiyle eklenenler)
  const { startOfDay } = getTurkeyDayBounds();

  const pendingArticles = await db
    .select({ id: processedArticles.id })
    .from(processedArticles)
    .where(
      and(
        eq(processedArticles.status, 'approved'),
        gte(processedArticles.createdAt, startOfDay),
      ),
    )
    .orderBy(processedArticles.createdAt)
    .limit(remainingQuota);

  let scheduled = 0;
  for (let i = 0; i < pendingArticles.length; i++) {
    const article = pendingArticles[i]!;
    const publishAt = await getNextPublishSlot();
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
    { scheduled, pendingArticles: pendingArticles.length, remainingQuota },
    '📅 Günlük publish planı dinamik kuyrukla hazırlandı',
  );
}

/**
 * Bir sonraki yayın zamanını Dinamik Kayan Kuyruk (Rolling Dynamic Queue) mantığıyla hesaplar:
 * 1. Baz Zaman: max(Şu An, Son Tweet Zamanı, Kuyruktaki En Son Hedef Zaman)
 * 2. Doğal Aralık Ekle: Baz zaman üzerine 35-50 dakika (+ ufak jitter) ekle.
 * 3. Gece Sessizlik Penceresi (Quiet Hours: 23:30 - 07:30 TR Saati):
 *    - Eğer hedef zaman gece uyku saatine denk geliyorsa, doğrudan sabah 07:35 - 08:30 aralığına ötele.
 *    - Gece birden fazla haber sıraya alınırsa, sabah kuşağında ardışık olarak (35-50 dk arayla) diz.
 */
export async function getNextPublishSlot(): Promise<Date> {
  const now = Date.now();

  // 1. Son yayınlanan tweet zamanını DB'den al
  let lastPublishedTime = 0;
  try {
    const [lastPublished] = await db
      .select({ publishedAt: publishedTweets.publishedAt })
      .from(publishedTweets)
      .orderBy(desc(publishedTweets.publishedAt))
      .limit(1);

    if (lastPublished?.publishedAt) {
      lastPublishedTime = new Date(lastPublished.publishedAt).getTime();
    }
  } catch (err: any) {
    log.warn({ err: err.message }, 'Son yayınlanan tweet zamanı sorgulanamadı');
  }

  // 2. Kuyruktaki bekleyen (delayed) işler arasındaki EN İLERİ zamanı bul
  let lastScheduledTime = 0;
  try {
    const delayedJobs = await publishQueue.getDelayed();
    for (const job of delayedJobs) {
      if (job.data && job.data.scheduledFor) {
        const time = new Date(job.data.scheduledFor).getTime();
        if (time > lastScheduledTime) {
          lastScheduledTime = time;
        }
      }
    }
  } catch (err: any) {
    log.warn({ err: err.message }, 'Kuyruktaki gecikmeli işler taranamadı');
  }

  // 3. Baz Zaman = En son aksiyonun zamanı
  // (Örn: Son tweet 10 dk önce atılmışsa o tweet baz alınır; 2 saat önce atılmışsa şimdiki an baz alınır)
  const baseTime = Math.max(now, lastPublishedTime, lastScheduledTime);

  // 4. Doğal Aralık: 35 - 50 dakika (ortalama ~42 dakika)
  const minIntervalMinutes = 35;
  const jitterMinutes = Math.floor(Math.random() * 15); // 0-14 dk
  const intervalMs = (minIntervalMinutes + jitterMinutes) * 60 * 1000;

  let proposedTime = new Date(baseTime + intervalMs);

  // 5. Türkiye Saat Dilimine Göre Gece Sessizlik Kontrolü (23:30 - 07:30)
  const trParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(proposedTime);

  const getPart = (type: string) => trParts.find((p) => p.type === type)?.value ?? '0';
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);

  const isQuietHours = (hour === 23 && minute >= 30) || (hour >= 0 && hour < 7) || (hour === 7 && minute < 30);

  if (isQuietHours) {
    // Gece 23:30 sonrası ise ertesi sabah, 00:00 - 07:30 arası ise bugünün sabahı
    let morningDateStr = `${year}-${month}-${day}`;
    if (hour === 23 && minute >= 30) {
      const nextDay = new Date(proposedTime.getTime() + 12 * 60 * 60 * 1000);
      morningDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(nextDay);
    }

    // Sabah 07:35 başlangıç tabanı (TR saati)
    const morningBase = new Date(`${morningDateStr}T07:35:00.000+03:00`).getTime();

    // Eğer kuyrukta o sabah için zaten bir haber planlanmışsa onun sonrasına 35-50 dk ekle
    if (lastScheduledTime >= morningBase) {
      const morningIntervalMs = (35 + Math.floor(Math.random() * 15)) * 60 * 1000;
      proposedTime = new Date(lastScheduledTime + morningIntervalMs);
    } else {
      // Sabahın ilk haberi: 07:35 + (0-10 dk jitter)
      const morningJitterMs = Math.floor(Math.random() * 10) * 60 * 1000;
      proposedTime = new Date(morningBase + morningJitterMs);
    }
  }

  // 6. Nihai Güvenlik Kontrolü: Kuyruktaki son işten veya son tweet'ten en az 30 dk sonra olmalı
  const strictMinAllowed = Math.max(now, lastScheduledTime, lastPublishedTime) + 30 * 60 * 1000;
  if (proposedTime.getTime() < strictMinAllowed) {
    proposedTime = new Date(strictMinAllowed + Math.floor(Math.random() * 5) * 60 * 1000);
  }

  log.info(
    {
      proposedSlot: proposedTime.toISOString(),
      turkeyTime: proposedTime.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }),
      baseRef: new Date(baseTime).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }),
    },
    '🎯 Dinamik Kayan Kuyruk yayın zamanı belirlendi',
  );

  return proposedTime;
}

/**
 * İlk başlatmada bekleyen approved makaleleri hemen zamanla
 */
export async function bootstrapPublishQueue(): Promise<void> {
  log.info('Publish queue bootstrap başlıyor...');
  await schedulePublishJobs();
}
