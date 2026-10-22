import { createHash } from 'crypto';
import { redis } from '../../lib/redis.js';
import { db } from '../../db/index.js';
import { rawArticles, processedArticles } from '../../db/schema.js';
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
 * Duplicate kontrolü — Sıralı 2 katmanlı akıllı kontrol:
 * 1. DB kontrolü (Nihai gerçeklik): Yalnızca processed_articles tablosuna başarıyla
 *    yazılmış makaleler gerçek duplicate sayılır. Eğer raw_articles'ta var ama
 *    processed_articles'ta yoksa, önceki bir denemede işlem yarım kalmıştır;
 *    duplicate sayılmaz, Redis kilidi silinir ve tekrar denenir.
 * 2. Redis kontrolü: DB'de raw kaydı olmayan ama filtrede elenmiş URL'ler.
 */
export async function isDuplicate(url: string): Promise<boolean> {
  const hash = hashUrl(url);
  const redisKey = `${URL_HASH_PREFIX}${hash}`;

  // Katman 1: DB Kontrolü
  const rawArticle = await db.query.rawArticles
    .findFirst({ where: eq(rawArticles.urlHash, hash) })
    .catch(() => null);

  if (rawArticle) {
    const processed = await db.query.processedArticles
      .findFirst({ where: eq(processedArticles.rawArticleId, rawArticle.id) })
      .catch(() => null);

    if (processed) {
      log.debug({ url, hash }, 'Duplicate tespit edildi (DB: İşlenmiş makale mevcut)');
      await redis.setex(redisKey, URL_HASH_TTL_SECONDS, '1');
      return true;
    } else {
      // raw_articles'ta var ama processed_articles'a girememiş (yarım kalmış/hata almış)
      log.info({ url, hash }, 'Öksüz/yarım kalmış makale tespit edildi, tekrar işleme açılıyor');
      await redis.del(redisKey).catch(() => {});
      return false;
    }
  }

  // Katman 2: Redis kontrolü (DB'de hiç yok ama filtrede/skorda elenmiş olanlar)
  const existsInRedis = await redis.exists(redisKey);
  if (existsInRedis) {
    log.debug({ url, hash }, 'Duplicate tespit edildi (Redis)');
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

