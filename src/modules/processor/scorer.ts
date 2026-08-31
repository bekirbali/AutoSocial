import { ALL_KEYWORDS } from '../../config/keywords.js';
import { createLogger } from '../../lib/logger.js';
import type { FetchedItem } from '../fetcher/rss.js';

const log = createLogger('processor:scorer');

export interface ScoreBreakdown {
  total: number;
  freshness: number;
  keyword: number;
  sourceReliability: number;
  titleQuality: number;
}

/**
 * Haber öncelik skoru hesapla (0-100)
 *
 * Ağırlıklar:
 * - Freshness:          %40
 * - Keyword eşleşmesi: %30
 * - Kaynak güvenilirliği: %20
 * - Başlık kalitesi:   %10
 */
export function scoreArticle(
  item: FetchedItem,
  sourceReliability: number, // 1-5 arası
): ScoreBreakdown {
  const freshness = calculateFreshness(item.publishedAt);
  const keyword = calculateKeywordScore(item.title, item.summary);
  const sourceScore = reliabilityToScore(sourceReliability);
  const quality = calculateTitleQuality(item.title);

  const total =
    freshness * 0.4 + keyword * 0.3 + sourceScore * 0.2 + quality * 0.1;

  const breakdown: ScoreBreakdown = {
    total: Math.round(total * 100) / 100,
    freshness: Math.round(freshness),
    keyword: Math.round(keyword),
    sourceReliability: Math.round(sourceScore),
    titleQuality: Math.round(quality),
  };

  log.debug(
    { url: item.url, score: breakdown },
    `Skor hesaplandı: ${breakdown.total.toFixed(1)}`,
  );

  return breakdown;
}

/**
 * Freshness skoru — yayın zamanı ne kadar yeni, o kadar yüksek
 * 0 dk = 100, 60 dk = ~83, 6 saat = ~50, 24 saat = 0
 */
function calculateFreshness(publishedAt: Date): number {
  const ageMinutes = (Date.now() - publishedAt.getTime()) / (1000 * 60);
  // Lineer azalma: 1440 dakika (24 saat) = 0 puan
  return Math.max(0, 100 - (ageMinutes / 1440) * 100);
}

/**
 * Keyword eşleşme skoru — niş anahtar kelimeleriyle örtüşme
 */
function calculateKeywordScore(title: string, summary?: string): number {
  const text = `${title} ${summary ?? ''}`.toLowerCase();
  const words = text.split(/\s+/).filter((w) => w.length > 2);

  if (words.length === 0) return 0;

  // Kaç niş keyword eşleşiyor?
  const matchedKeywords = ALL_KEYWORDS.filter((kw) =>
    text.includes(kw.toLowerCase()),
  );

  // Max 5 keyword eşleşmesi = 100 puan (daha fazlası bonus)
  const baseScore = Math.min(matchedKeywords.length / 5, 1) * 100;

  // Başlıkta keyword varsa +20 bonus
  const titleBonus = ALL_KEYWORDS.some((kw) =>
    title.toLowerCase().includes(kw.toLowerCase()),
  )
    ? 20
    : 0;

  return Math.min(baseScore + titleBonus, 100);
}

/**
 * Kaynak güvenilirliğini 0-100 arası skora çevir
 * 1 yıldız = 20, 5 yıldız = 100
 */
function reliabilityToScore(reliability: number): number {
  return Math.max(20, Math.min(100, reliability * 20));
}

/**
 * Başlık kalite skoru — engagement potansiyeli tahmini
 */
function calculateTitleQuality(title: string): number {
  let score = 50; // Temel puan

  // Soru işareti — merak uyandırır
  if (title.includes('?')) score += 15;

  // Sayı içeriyor — somutluk
  if (/\d/.test(title)) score += 10;

  // Aksiyon kelimeleri — güçlü başlıklar
  const actionWords = [
    'launches', 'reveals', 'confirms', 'breaks', 'beats', 'record',
    'new', 'first', 'best', 'fastest', 'cheapest', 'review', 'tested',
    'duyurdu', 'çıktı', 'geldi', 'ilk', 'en hızlı', 'en ucuz', 'test',
    'benchmark', 'inceleme', 'leak', 'sızdı',
  ];
  if (actionWords.some((w) => title.toLowerCase().includes(w))) score += 15;

  // Çok kısa başlık
  if (title.length < 30) score -= 20;

  // Çok uzun başlık (clickbait işareti)
  if (title.length > 120) score -= 10;

  // Tümü büyük harf (spam işareti)
  if (title === title.toUpperCase() && title.length > 10) score -= 20;

  return Math.max(0, Math.min(100, score));
}
