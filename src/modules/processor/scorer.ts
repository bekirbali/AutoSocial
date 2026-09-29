import { isForeignDeal } from './dealFilter.js';
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

  let total =
    freshness * 0.4 + keyword * 0.3 + sourceScore * 0.2 + quality * 0.1;

  // Negatif filtre: Sürücü yamaları, rutin firmware, çeyrek finansal raporları, önemsiz renk/aksesuar haberleri
  const noiseCheck = checkNoisePenalty(item.title, item.summary);
  if (noiseCheck.isNoise) {
    log.info(
      { url: item.url, title: item.title, reason: noiseCheck.reason },
      'Rutin/Gürültü haber tespit edildi, negatif ceza uygulanıyor (-45 puan)',
    );
    total = Math.max(0, total - 45);
  }

  // Yabancı kaynaklardaki (EN / DE) indirim/fırsat haberlerini filtrele
  // Proje hedef kitlesi Türk kullanıcılar olduğu için global indirimlerin değeri yok
  if (isForeignDeal(item)) {
    log.info(
      { url: item.url, title: item.title },
      'Yabancı indirim/fırsat haberi tespit edildi, skor sıfırlanıyor',
    );
    total = 0; // Skor sıfırlanır, AI işleme girmeden 'low_score' olarak elenir
  }

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

/**
 * Rutin, sıkıcı veya tüketicinin doğrudan cebine/işine yaramayan gürültü haberleri tespit eder.
 */
function checkNoisePenalty(title: string, summary?: string): { isNoise: boolean; reason?: string } {
  const text = `${title} ${summary ?? ''}`.toLowerCase();

  // 1. Sürücü ve yama / rutin firmware
  const driverPatterns = [
    /\bdriver\s+update\b/i,
    /\bgame\s+ready\s+driver\b/i,
    /\bradeon\s+software\b/i,
    /\bradeon\s+adrenalin\b/i,
    /\bgeforce\s+driver\b/i,
    /\bwhql\s+driver\b/i,
    /\bbios\s+update\b/i,
    /\bfirmware\s+update\b/i,
    /\bpatch\s+notes\b/i,
    /\bhotfix\b/i,
    /\bmicrocode\b/i,
    /\bsürücü\s+güncelleme/i,
    /\byeni\s+sürücü\b/i,
  ];
  if (driverPatterns.some((p) => p.test(text))) {
    return { isNoise: true, reason: 'driver_or_patch' };
  }

  // 2. Çeyrek finansal raporlar, şirket hisse ve borsa haberleri
  const financialPatterns = [
    /\bquarterly\s+(results|earnings|revenue)\b/i,
    /\bfinancial\s+results\b/i,
    /\bq[1-4]\s+(results|earnings|revenue|profit)\b/i,
    /\bearnings\s+(call|report)\b/i,
    /\brevenue\s+(rises|falls|up|down|hits)\b/i,
    /\bshares\s+(rise|fall|drop|surge)\b/i,
    /\bmarket\s+cap\b/i,
    /\bçeyrek\s+sonuç/i,
    /\bmali\s+tablo/i,
    /\bgelir\s+rapor/i,
    /\bhisseleri\s+(yükseldi|düştü|fırladı)/i,
  ];
  if (financialPatterns.some((p) => p.test(text))) {
    return { isNoise: true, reason: 'corporate_financial' };
  }

  // 3. Önemsiz renk seçenekleri ve basit kılıf aksesuarları
  const accessoryPatterns = [
    /\bnow\s+available\s+in\s+(black|white|purple|pink|blue|red|green|gold|silver)\b/i,
    /\bnew\s+color\s+option\b/i,
    /\byeni\s+renk\s+seçeneği\b/i,
    /\bprotective\s+case\b/i,
    /\bphone\s+cases?\b/i,
  ];
  if (accessoryPatterns.some((p) => p.test(text))) {
    return { isNoise: true, reason: 'minor_color_or_accessory' };
  }

  // 4. Şirket içi yönetici atamaları
  const execPatterns = [
    /\bappoints\s+new\b/i,
    /\bnames\s+new\s+(ceo|cfo|coo|president|vp)\b/i,
    /\bboard\s+of\s+directors\b/i,
  ];
  if (execPatterns.some((p) => p.test(text))) {
    return { isNoise: true, reason: 'executive_appointment' };
  }

  return { isNoise: false };
}

