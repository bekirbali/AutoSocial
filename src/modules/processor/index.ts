import { db } from '../../db/index.js';
import { rawArticles, processedArticles, sources } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createLogger } from '../../lib/logger.js';
import { isDuplicate, markAsProcessed, hasSimilarTitle } from './dedup.js';
import { filterArticle } from './filter.js';
import { scoreArticle } from './scorer.js';
import { generateTweet } from './ai.js';
import { generateNewsCard } from './image.js';
import { hashUrl } from './dedup.js';
import { detectCategory } from '../../config/keywords.js';
import { env } from '../../config/env.js';
import type { FetchedItem } from '../fetcher/rss.js';
import { SOURCES } from '../../config/sources.js';

const log = createLogger('processor');

export interface ProcessResult {
  url: string;
  status: 'processed' | 'duplicate' | 'filtered' | 'low_score' | 'failed';
  reason?: string;
  score?: number;
  processedArticleId?: string; // publish job için — sadece status==='processed' durumunda
  dbStatus?: 'pending' | 'approved';
}

/**
 * Tek bir FetchedItem'ı işleyen ana pipeline
 * dedup → filter → score → ai → image → db'ye kaydet
 */
export async function processArticle(item: FetchedItem): Promise<ProcessResult> {
  const logCtx = { url: item.url, title: item.title.substring(0, 60) };

  try {
    // ─── ADIM 1: Duplicate Kontrolü ──────────────────────────────────────────
    if (await isDuplicate(item.url)) {
      return { url: item.url, status: 'duplicate', reason: 'url_seen' };
    }

    if (await hasSimilarTitle(item.title, 24)) {
      await markAsProcessed(item.url);
      return { url: item.url, status: 'duplicate', reason: 'similar_title' };
    }

    // ─── ADIM 2: İçerik Filtreleme ───────────────────────────────────────────
    const filterResult = filterArticle(item);
    if (!filterResult.passed) {
      await markAsProcessed(item.url);
      return { url: item.url, status: 'filtered', reason: filterResult.reason };
    }

    // ─── ADIM 3: Kaynak Güvenilirlik Skoru ───────────────────────────────────
    const sourceConfig = SOURCES.find((s) => s.id === item.sourceId);
    const reliability = sourceConfig?.reliability ?? 3;

    // ─── ADIM 4: Öncelik Skoru ───────────────────────────────────────────────
    const scoreBreakdown = scoreArticle(item, reliability);

    if (scoreBreakdown.total < env.MIN_SCORE_THRESHOLD) {
      await markAsProcessed(item.url);
      log.debug(
        { ...logCtx, score: scoreBreakdown.total, threshold: env.MIN_SCORE_THRESHOLD },
        'Skor eşiğin altında, atlanıyor',
      );
      return {
        url: item.url,
        status: 'low_score',
        reason: `score:${scoreBreakdown.total}`,
        score: scoreBreakdown.total,
      };
    }

    // ─── ADIM 5: Ham Makaleyi DB'ye Kaydet ───────────────────────────────────
    const urlHash = hashUrl(item.url);
    const [rawArticle] = await db
      .insert(rawArticles)
      .values({
        sourceId: await getDbSourceId(item.sourceId),
        url: item.url,
        urlHash,
        title: item.title,
        summary: item.summary,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt,
        lang: item.lang,
        categories: detectCategory(item.title + ' ' + (item.summary ?? '')).split(','),
      })
      .onConflictDoNothing()
      .returning();

    if (!rawArticle) {
      // Conflict — aynı URL zaten var (race condition)
      await markAsProcessed(item.url);
      return { url: item.url, status: 'duplicate', reason: 'db_conflict' };
    }

    // ─── ADIM 6: Kategori Tespiti ────────────────────────────────────────────
    const category = detectCategory(item.title + ' ' + (item.summary ?? ''));

    // ─── ADIM 7: AI ile Tweet Üretimi ────────────────────────────────────────
    const tweetResult = await generateTweet(
      item.title,
      item.summary,
      item.sourceName,
      category,
    );

    // ─── ADIM 8: Görsel Üretimi ───────────────────────────────────────────────
    let imagePath: string | undefined;
    let imageSource: string | undefined;

    try {
      const imageResult = await generateNewsCard(
        tweetResult.translatedTitle,
        item.sourceName,
        category,
        item.publishedAt,
        rawArticle.id,
      );
      imagePath = imageResult.imagePath;
      imageSource = imageResult.imageSource;
    } catch (imgErr) {
      log.warn(
        { err: imgErr instanceof Error ? imgErr.message : imgErr, url: item.url },
        'Görsel üretimi başarısız, görselsiz devam ediliyor',
      );
    }

    // ─── ADIM 9: İşlenmiş Makaleyi DB'ye Kaydet ─────────────────────────────
    const status = env.APP_MODE === 'hybrid' ? 'pending' : 'approved';

    const [savedProcessed] = await db.insert(processedArticles).values({
      rawArticleId: rawArticle.id,
      score: scoreBreakdown.total.toString(),
      tweetText: tweetResult.tweetText,
      hashtags: tweetResult.hashtags,
      threadTweets: tweetResult.threadTweets,
      imagePath,
      imageSource,
      tone: tweetResult.tone,
      category,
      status,
    }).returning();

    // Redis'e işlenmiş olarak kaydet
    await markAsProcessed(item.url);

    log.info(
      {
        ...logCtx,
        score: scoreBreakdown.total,
        category,
        tweetLength: tweetResult.tweetText.length,
        status,
      },
      '✅ Makale işlendi',
    );

    return {
      url: item.url,
      status: 'processed',
      score: scoreBreakdown.total,
      processedArticleId: savedProcessed?.id,
      dbStatus: status,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ ...logCtx, err: errMsg }, 'Makale işleme başarısız');
    return { url: item.url, status: 'failed', reason: errMsg };
  }
}

/**
 * Birden fazla makaleyi sırayla işle (Gemini rate limit için seri, paralel değil)
 */
export async function processArticles(
  items: FetchedItem[],
): Promise<{ processed: number; duplicate: number; filtered: number; failed: number }> {
  const stats = { processed: 0, duplicate: 0, filtered: 0, failed: 0 };

  log.info({ count: items.length }, 'Makaleler işleniyor');

  for (const item of items) {
    // Gemini free tier için istekler arası 100ms bekleme
    await sleep(100);

    const result = await processArticle(item);

    switch (result.status) {
      case 'processed':
        stats.processed++;
        break;
      case 'duplicate':
        stats.duplicate++;
        break;
      case 'filtered':
      case 'low_score':
        stats.filtered++;
        break;
      case 'failed':
        stats.failed++;
        break;
    }
  }

  log.info(stats, 'İşleme tamamlandı');
  return stats;
}

/**
 * Config'deki source ID'ye göre DB'deki kaydı bul
 * Config ID = source.name ile eşleştiriyoruz
 */
async function getDbSourceId(configSourceId: string): Promise<string | undefined> {
  const sourceConfig = SOURCES.find((s) => s.id === configSourceId);
  if (!sourceConfig) return undefined;

  const result = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.name, sourceConfig.name))
    .limit(1)
    .catch(() => []);

  return result[0]?.id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
