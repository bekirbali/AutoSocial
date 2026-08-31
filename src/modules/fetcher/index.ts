import { getActiveSources } from '../../config/sources.js';
import { db } from '../../db/index.js';
import { sources } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createLogger } from '../../lib/logger.js';
import { fetchRssFeed, type FetchedItem } from './rss.js';
import type { SourceConfig } from '../../config/sources.js';

const log = createLogger('fetcher');

export interface FetchResult {
  sourceId: string;
  items: FetchedItem[];
  success: boolean;
  error?: string;
}

/**
 * Tüm aktif kaynaklardan paralel olarak RSS çek (max 5 eşzamanlı)
 */
export async function fetchAllSources(): Promise<FetchedItem[]> {
  const activeSources = getActiveSources();
  log.info({ count: activeSources.length }, 'Kaynaklar çekiliyor');

  // Max 5 paralel istek (kaynak sunucuları yormamak için)
  const CONCURRENCY = 5;
  const allItems: FetchedItem[] = [];
  const chunks = chunkArray(activeSources, CONCURRENCY);

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((source) => fetchSourceWithTracking(source)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value.items);
      }
    }
  }

  log.info({ totalItems: allItems.length }, 'Tüm kaynaklar çekildi');
  return allItems;
}

/**
 * Tek kaynak çek + başarısızlık takibi
 */
async function fetchSourceWithTracking(source: SourceConfig): Promise<FetchResult> {
  try {
    const items = await fetchRssFeed(source);

    // Başarılı çekim — hata sayacını sıfırla, last_fetched_at güncelle
    await db
      .update(sources)
      .set({
        consecutiveFailures: 0,
        lastFetchedAt: new Date(),
      })
      .where(eq(sources.id, source.id))
      .catch(() => {}); // DB güncelleme hatası kritik değil

    return { sourceId: source.id, items, success: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    // Başarısızlık sayacını artır
    await db
      .update(sources)
      .set({
        consecutiveFailures: (source as SourceConfig & { consecutiveFailures?: number })
          .consecutiveFailures
          ? ((source as SourceConfig & { consecutiveFailures?: number }).consecutiveFailures ?? 0) +
            1
          : 1,
      })
      .where(eq(sources.id, source.id))
      .catch(() => {});

    // 5 ardışık başarısızlıkta kaynağı devre dışı bırak
    const failures = await db.query.sources
      .findFirst({ where: eq(sources.id, source.id) })
      .then((s) => s?.consecutiveFailures ?? 0)
      .catch(() => 0);

    if (failures >= 5) {
      log.error(
        { sourceId: source.id, failures },
        `${source.name} — 5 ardışık hata, kaynak devre dışı bırakılıyor`,
      );
      await db
        .update(sources)
        .set({ isActive: false })
        .where(eq(sources.id, source.id))
        .catch(() => {});
    }

    return { sourceId: source.id, items: [], success: false, error: errMsg };
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
