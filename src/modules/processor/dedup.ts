import { createHash } from 'crypto';
import { redis } from '../../lib/redis.js';
import { db } from '../../db/index.js';
import { rawArticles } from '../../db/schema.js';
import { eq, gte, sql } from 'drizzle-orm';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('processor:dedup');

// Redis key prefix ve TTL
const URL_HASH_PREFIX = 'autosocial:url:';
const URL_HASH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 gün

/**
 * URL'yi SHA-256 ile hash'le
 */
export function hashUrl(url: string): string {
  return createHash('sha256').update(url.trim().toLowerCase()).digest('hex');
}

/**
 * Duplicate kontrolü — sıralı 2 katmanlı kontrol:
 * 1. Redis'te URL hash var mı? (O(1), hızlı)
 * 2. PostgreSQL'de URL var mı? (Redis'in sıfırlandığı durumlar için)
 */
export async function isDuplicate(url: string): Promise<boolean> {
  const hash = hashUrl(url);
  const redisKey = `${URL_HASH_PREFIX}${hash}`;

  // Katman 1: Redis kontrolü
  const existsInRedis = await redis.exists(redisKey);
  if (existsInRedis) {
    log.debug({ url, hash }, 'Duplicate tespit edildi (Redis)');
    return true;
  }

  // Katman 2: DB kontrolü (Redis sıfırlanmış olabilir)
  const existsInDb = await db.query.rawArticles
    .findFirst({ where: eq(rawArticles.urlHash, hash) })
    .then((r) => !!r)
    .catch(() => false);

  if (existsInDb) {
    log.debug({ url, hash }, 'Duplicate tespit edildi (DB)');
    // Redis'e ekle (cache yenile)
    await redis.setex(redisKey, URL_HASH_TTL_SECONDS, '1');
    return true;
  }

  return false;
}

/**
 * URL'yi işlenmiş olarak işaretle — Redis'e ekle
 */
export async function markAsProcessed(url: string): Promise<void> {
  const hash = hashUrl(url);
  const redisKey = `${URL_HASH_PREFIX}${hash}`;
  await redis.setex(redisKey, URL_HASH_TTL_SECONDS, '1');
}

/**
 * Basit benzer başlık kontrolü — Levenshtein distance tabanlı
 * Aynı gün içinde %85+ benzer başlık varsa duplicate say
 */
export async function hasSimilarTitle(
  title: string,
  withinHours = 24,
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);

  // Son N saatteki başlıkları çek
  const recentTitles = await db
    .select({ title: rawArticles.title })
    .from(rawArticles)
    .where(gte(rawArticles.fetchedAt, since))
    .catch(() => []);

  if (recentTitles.length === 0) return false;

  const normalizedTitle = normalizeTitle(title);

  for (const { title: existingTitle } of recentTitles) {
    const normalizedExisting = normalizeTitle(existingTitle);
    const similarity = calculateSimilarity(normalizedTitle, normalizedExisting);
    if (similarity >= 0.60) {
      log.info(
        { title, existingTitle, similarity: similarity.toFixed(2) },
        'Aynı konulu kopya haber tespit edildi (cross-source duplicate)',
      );
      return true;
    }
  }

  return false;
}

// Sık kullanılan genel İngilizce/Türkçe dolgu ve bağlaç kelimeleri
const STOP_WORDS = new Set([
  'with', 'that', 'this', 'from', 'over', 'more', 'after', 'will', 'says',
  'said', 'have', 'into', 'report', 'reports', 'about', 'first', 'could',
  'been', 'what', 'when', 'then', 'here', 'just', 'some', 'than', 'them',
  'göre', 'yeni', 'olan', 'için', 'diye', 'kadar', 'daha', 'olarak', 'sonra',
]);

/**
 * Başlığı normalize et — küçük harf, noktalama temizle
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * İki başlık arasındaki semantik teknoloji örtüşme oranı (Dice katsayısı)
 * PS5, PS6, M4, RTX gibi 2-3 harfli kritik modelleri korur; genel stop word'leri eler.
 */
function calculateSimilarity(a: string, b: string): number {
  const tokensA = new Set(
    a
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t)),
  );
  const tokensB = new Set(
    b
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t)),
  );

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection++;
  });

  // Dice coefficient: 2 * |A ∩ B| / (|A| + |B|)
  return (2 * intersection) / (tokensA.size + tokensB.size);
}

