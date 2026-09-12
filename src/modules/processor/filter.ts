import { DOMAIN_BLACKLIST, KEYWORD_BLACKLIST, ALL_KEYWORDS } from '../../config/keywords.js';
import { createLogger } from '../../lib/logger.js';
import type { FetchedItem } from '../fetcher/rss.js';

const log = createLogger('processor:filter');

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

/**
 * İçerik filtresi — sırayla uygulanan kontroller
 * İlk başarısız kontrol filtre sonucunu belirler
 */
export function filterArticle(item: FetchedItem): FilterResult {
  const titleLower = item.title.toLowerCase();
  const urlLower = item.url.toLowerCase();

  // 1. URL boş mu?
  if (!item.url || item.url.length < 10) {
    return { passed: false, reason: 'url_empty' };
  }

  // 2. Başlık boş veya çok kısa mu?
  if (!item.title || item.title.trim().length < 10) {
    return { passed: false, reason: 'title_too_short' };
  }

  // 3. Domain kara listesi
  const domain = extractDomain(item.url);
  if (DOMAIN_BLACKLIST.some((d) => domain.includes(d))) {
    return { passed: false, reason: `domain_blacklisted:${domain}` };
  }

  // 4. Anahtar kelime kara listesi (başlık veya URL)
  const blacklisted = KEYWORD_BLACKLIST.find(
    (kw) => titleLower.includes(kw) || urlLower.includes(kw),
  );
  if (blacklisted) {
    return { passed: false, reason: `keyword_blacklisted:${blacklisted}` };
  }

  // 5. Niş anahtar kelime eşleşmesi — hiç yoksa atla
  const hasNicheKeyword = ALL_KEYWORDS.some(
    (kw) => titleLower.includes(kw.toLowerCase()) || urlLower.includes(kw.toLowerCase()),
  );
  if (!hasNicheKeyword) {
    return { passed: false, reason: 'no_niche_keyword' };
  }

  // 6. Çok eski içerik filtresi — 48 saatten eski
  const ageHours = (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours > 48) {
    return { passed: false, reason: `too_old:${Math.round(ageHours)}h` };
  }

  log.debug({ url: item.url, title: item.title }, 'Filtre geçti');
  return { passed: true };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
