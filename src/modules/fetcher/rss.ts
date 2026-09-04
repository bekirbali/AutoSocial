import Parser from 'rss-parser';
import { createLogger } from '../../lib/logger.js';
import type { SourceConfig } from '../../config/sources.js';

const log = createLogger('fetcher:rss');

// RSS parser — özel alanlar ekle
const parser = new Parser({
  timeout: 10_000,
  headers: {
    'User-Agent':
      'AutoSocial/1.0 (RSS Reader; +https://github.com/autosocial) Mozilla/5.0',
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure', 'enclosure', { keepArray: false }],
    ],
  },
});

export interface FetchedItem {
  url: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  publishedAt: Date;
  sourceName: string;
  sourceId: string;
  lang: string;
}

/**
 * Tek bir RSS kaynağından makaleleri çeker.
 * Timeout: 10 saniye, Retry: 3 deneme, exponential backoff
 */
export async function fetchRssFeed(
  source: SourceConfig,
  maxItems = 20,
): Promise<FetchedItem[]> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.debug({ sourceId: source.id, url: source.rssUrl, attempt }, 'RSS çekiliyor');

      const feed = await parser.parseURL(source.rssUrl);
      const items = (feed.items ?? []).slice(0, maxItems);

      log.info(
        { sourceId: source.id, itemCount: items.length },
        `${source.name} — ${items.length} makale çekildi`,
      );

      return items.map((item) => mapItem(item, source));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delayMs = Math.pow(5, attempt) * 1000; // 5s → 25s → 125s (5^1 → 5^2 → 5^3)
        log.warn(
          { sourceId: source.id, attempt, delayMs, err: lastError.message },
          'RSS çekme başarısız, yeniden deneniyor',
        );
        await sleep(delayMs);
      }
    }
  }

  log.error(
    { sourceId: source.id, err: lastError?.message },
    `${source.name} — ${maxRetries} denemede RSS çekilemedi`,
  );

  throw lastError ?? new Error(`RSS fetch failed for ${source.id}`);
}

/**
 * RSS item'ını FetchedItem'a dönüştür
 */
function mapItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: Record<string, any>,
  source: SourceConfig,
): FetchedItem {
  const url = item['link'] ?? item['guid'] ?? '';
  const title = item['title'] ?? '';
  const summary = item['contentSnippet'] ?? item['content'] ?? item['summary'] ?? undefined;

  // Görsel URL tespiti — çeşitli RSS formatları dene
  const imageUrl =
    item['mediaContent']?.['$']?.['url'] ??
    item['mediaThumbnail']?.['$']?.['url'] ??
    item['enclosure']?.['url'] ??
    extractImageFromContent(item['content'] ?? '') ??
    undefined;

  const publishedAt = item['pubDate']
    ? new Date(item['pubDate'])
    : item['isoDate']
      ? new Date(item['isoDate'])
      : new Date();

  return {
    url: url.trim(),
    title: title.trim(),
    summary: summary ? stripHtml(summary).substring(0, 500) : undefined,
    imageUrl,
    publishedAt,
    sourceName: source.name,
    sourceId: source.id,
    lang: source.lang,
  };
}

/**
 * HTML içeriğinden ilk img src'yi çıkar
 */
function extractImageFromContent(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

/**
 * Basit HTML temizleme
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
