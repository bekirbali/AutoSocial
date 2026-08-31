import { db } from '../../db/index.js';
import { processedArticles, publishedTweets, rawArticles } from '../../db/schema.js';
import { eq, and, lte, gte, count } from 'drizzle-orm';
import { createLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { checkRateLimit } from './twitter.js';

const log = createLogger('publisher:scheduler');

// Günlük yayın zaman dilimleri (saat, 24h format)
const TWEET_SLOTS = [
  { start: 7, end: 9 },    // Sabah
  { start: 12, end: 14 },  // Öğle
  { start: 18, end: 20 },  // Akşam
  { start: 21, end: 23 },  // Gece
];

// Hafta sonu azaltma oranı (%30)
const WEEKEND_REDUCTION = 0.7;

// Tweetler arası minimum süre (dakika)
const MIN_INTERVAL_MINUTES = 30;

/**
 * Bugün için yayın planı oluştur
 * @returns Yayın zamanları (UTC Date dizisi)
 */
export function generateDailySchedule(date: Date = new Date()): Date[] {
  const dayOfWeek = date.getDay(); // 0=Pazar, 6=Cumartesi
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let maxTweets = env.MAX_TWEETS_PER_DAY;
  if (isWeekend) {
    maxTweets = Math.floor(maxTweets * WEEKEND_REDUCTION);
  }

  const minTweets = isWeekend
    ? Math.floor(env.MIN_TWEETS_PER_DAY * WEEKEND_REDUCTION)
    : env.MIN_TWEETS_PER_DAY;

  // Her dilime eşit dağıt
  const slotsCount = TWEET_SLOTS.length;
  const tweetsPerSlot = Math.ceil(maxTweets / slotsCount);
  const scheduledTimes: Date[] = [];

  for (const slot of TWEET_SLOTS) {
    const slotTweets = Math.min(tweetsPerSlot, 3); // Slot başına max 3

    for (let i = 0; i < slotTweets; i++) {
      if (scheduledTimes.length >= maxTweets) break;

      // Slot içinde rastgele zaman
      const jitterRange = (slot.end - slot.start) * 60; // dakika
      const minuteOffset = Math.floor(Math.random() * jitterRange);
      const totalMinutes = slot.start * 60 + minuteOffset;

      const tweetTime = new Date(date);
      tweetTime.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);

      // Random jitter: ±1-12 dakika
      const jitter = (Math.random() * 24 - 12) * 60 * 1000; // ±12 dakika
      tweetTime.setTime(tweetTime.getTime() + jitter);

      scheduledTimes.push(tweetTime);
    }
  }

  // Zamana göre sırala
  scheduledTimes.sort((a, b) => a.getTime() - b.getTime());

  // Min interval kontrolü
  const finalTimes = enforceMinInterval(scheduledTimes, MIN_INTERVAL_MINUTES);

  log.info(
    {
      date: date.toLocaleDateString('tr-TR'),
      isWeekend,
      count: finalTimes.length,
      minTweets,
      maxTweets,
    },
    'Günlük yayın planı oluşturuldu',
  );

  return finalTimes;
}

/**
 * Bugün yayınlanan tweet sayısını kontrol et
 */
export async function getTodayPublishedCount(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await db
    .select({ count: count() })
    .from(publishedTweets)
    .where(
      and(
        gte(publishedTweets.publishedAt, today),
        lte(publishedTweets.publishedAt, tomorrow),
      ),
    );

  return result[0]?.count ?? 0;
}

/**
 * Bir sonraki tweet'in ne zaman atılması gerektiğini hesapla
 * Rate limit kontrolü dahil
 */
export async function getNextPublishTime(): Promise<{
  canPublish: boolean;
  waitMs: number;
  reason?: string;
}> {
  // Rate limit kontrolü
  const { tweets: remaining, resetAt } = await checkRateLimit();

  if (remaining < 5) {
    const waitMs = resetAt ? resetAt.getTime() - Date.now() : 60 * 60 * 1000;
    log.warn({ remaining, resetAt }, 'Rate limit düşük, bekleniyor');
    return { canPublish: false, waitMs, reason: 'rate_limit' };
  }

  // Günlük limit kontrolü
  const todayCount = await getTodayPublishedCount();
  if (todayCount >= env.MAX_TWEETS_PER_DAY) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(7, 0, 0, 0);
    const waitMs = tomorrow.getTime() - Date.now();
    return { canPublish: false, waitMs, reason: 'daily_limit' };
  }

  return { canPublish: true, waitMs: 0 };
}

export interface ApprovedArticleRow {
  id: string;
  tweetText: string;
  hashtags: unknown;
  imagePath: string | null;
  score: string | null;
  status: string;
  articleUrl: string | null;
}

/**
 * Onaylanmış bir sonraki haberi DB'den çek (JOIN ile kaynak URL dahil)
 */
export async function getNextApprovedArticle(): Promise<ApprovedArticleRow | null> {
  const results = await db
    .select({
      id: processedArticles.id,
      tweetText: processedArticles.tweetText,
      hashtags: processedArticles.hashtags,
      imagePath: processedArticles.imagePath,
      score: processedArticles.score,
      status: processedArticles.status,
      articleUrl: rawArticles.url,
    })
    .from(processedArticles)
    .leftJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .where(eq(processedArticles.status, 'approved'))
    .orderBy(processedArticles.createdAt)
    .limit(1);

  return results[0] ?? null;
}

/**
 * Minimum interval kontrolü — çok yakın zamanlı tweetleri düzelt
 */
function enforceMinInterval(times: Date[], minMinutes: number): Date[] {
  const result: Date[] = [];
  let lastTime: Date | null = null;

  for (const time of times) {
    if (!lastTime || time.getTime() - lastTime.getTime() >= minMinutes * 60 * 1000) {
      result.push(time);
      lastTime = time;
    }
  }

  return result;
}
