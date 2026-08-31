import { createLogger } from '../../lib/logger.js';
import { db } from '../../db/index.js';
import { dailyStats } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const log = createLogger('analytics:dailyStats');

// ─── In-Memory Counter (DB'ye periyodik flush) ────────────────────────────────

interface StatsDelta {
  articlesFetched?: number;
  articlesProcessed?: number;
  articlesPublished?: number;
  articlesRejected?: number;
}

// Günlük in-memory birikimi — flush() çağrıldığında DB'ye yazılır
const memoryBuffer: StatsDelta = {
  articlesFetched: 0,
  articlesProcessed: 0,
  articlesPublished: 0,
  articlesRejected: 0,
};

/**
 * İstatistik sayacını artır (in-memory, hızlı)
 * Worker'lar her işlemden sonra çağırır.
 */
export function updateDailyStats(delta: StatsDelta): Promise<void> {
  if (delta.articlesFetched) memoryBuffer.articlesFetched! += delta.articlesFetched;
  if (delta.articlesProcessed) memoryBuffer.articlesProcessed! += delta.articlesProcessed;
  if (delta.articlesPublished) memoryBuffer.articlesPublished! += delta.articlesPublished;
  if (delta.articlesRejected) memoryBuffer.articlesRejected! += delta.articlesRejected;
  return Promise.resolve();
}

/**
 * In-memory buffer'ı daily_stats tablosuna yaz (upsert)
 * Analytics worker tarafından periyodik olarak çağrılır.
 */
export async function flushDailyStats(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD

  // Buffer'da herhangi bir değişiklik var mı?
  const hasChanges = Object.values(memoryBuffer).some((v) => (v ?? 0) > 0);
  if (!hasChanges) {
    log.debug('Flush: değişiklik yok, atlanıyor');
    return;
  }

  const snapshot = { ...memoryBuffer };

  try {
    await db
      .insert(dailyStats)
      .values({
        date: today,
        articlesFetched: snapshot.articlesFetched ?? 0,
        articlesProcessed: snapshot.articlesProcessed ?? 0,
        articlesPublished: snapshot.articlesPublished ?? 0,
        articlesRejected: snapshot.articlesRejected ?? 0,
      })
      .onConflictDoUpdate({
        target: dailyStats.date,
        set: {
          articlesFetched: sql`${dailyStats.articlesFetched} + ${snapshot.articlesFetched ?? 0}`,
          articlesProcessed: sql`${dailyStats.articlesProcessed} + ${snapshot.articlesProcessed ?? 0}`,
          articlesPublished: sql`${dailyStats.articlesPublished} + ${snapshot.articlesPublished ?? 0}`,
          articlesRejected: sql`${dailyStats.articlesRejected} + ${snapshot.articlesRejected ?? 0}`,
        },
      });

    // Buffer'ı sıfırla (sadece flush edilen değerleri)
    memoryBuffer.articlesFetched = 0;
    memoryBuffer.articlesProcessed = 0;
    memoryBuffer.articlesPublished = 0;
    memoryBuffer.articlesRejected = 0;

    log.info({ date: today, ...snapshot }, 'daily_stats flushed');
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : err }, 'daily_stats flush başarısız');
    // Buffer sıfırlanmıyor — bir sonraki flush'ta tekrar denenecek
  }
}

/**
 * Bugünkü istatistikleri çek (log/rapor için)
 */
export async function getTodayStats(): Promise<StatsDelta> {
  const today = new Date().toISOString().split('T')[0]!;

  const result = await db
    .select()
    .from(dailyStats)
    .where(eq(dailyStats.date, today))
    .limit(1)
    .catch(() => []);

  const row = result[0];
  if (!row) return {};

  return {
    articlesFetched: row.articlesFetched,
    articlesProcessed: row.articlesProcessed,
    articlesPublished: row.articlesPublished,
    articlesRejected: row.articlesRejected,
  };
}
