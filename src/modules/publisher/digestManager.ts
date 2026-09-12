import { db } from '../../db/index.js';
import {
  processedArticles,
  rawArticles,
  sources,
  instagramDigests,
  publishedTweets,
  type InstagramDigest,
} from '../../db/schema.js';
import { eq, and, desc, inArray, gte } from 'drizzle-orm';
import { generateDigestSlideCard } from '../processor/image.js';
import { generateDigestReel } from '../processor/digestGenerator.js';
import { generateDigestCaption } from '../processor/ai.js';
import { postToInstagram } from './instagram.js';
import { sendDigestApprovalRequest } from '../telegram/bot.js';
import { createLogger } from '../../lib/logger.js';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import type { ArticleCategory } from '../../config/keywords.js';

const log = createLogger('publisher:digestManager');

export type DigestType = 'noon' | 'evening' | 'manual';

/**
 * Haber için Türkçe vurucu başlığı belirler.
 * Öncelik: translatedTitle -> tweetText'in ilk cümlesi -> rawTitle
 */
export function getTurkishHeadline(item: {
  translatedTitle?: string | null;
  tweetText: string;
  rawTitle: string;
}): string {
  if (item.translatedTitle && item.translatedTitle.trim()) {
    return item.translatedTitle.trim();
  }

  // tweetText Türkçe üretildiği için ilk cümlesi veya kancası başlık olarak kullanılır
  const firstLine = item.tweetText.split('\n')[0]?.trim() || '';
  const sentenceMatch = firstLine.match(/^(.+?[.!?])(\s|$)/);
  let candidate = (sentenceMatch ? sentenceMatch[1] : firstLine) || '';

  candidate = candidate
    .replace(/^[🚀⚡️🔥📌📢🚨📰\s]+/, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();

  if (candidate.length >= 10 && candidate.length <= 110) {
    return candidate;
  }
  if (candidate.length > 110) {
    return candidate.slice(0, 107).trim() + '...';
  }

  return item.rawTitle;
}

/**
 * X'te yayınlanmış ancak henüz bültende yer almamış haberleri toplayıp
 * çoklu slaytlı 9:16 Instagram Reels bülteni oluşturur ve Telegram onayına gönderir.
 */
export async function createDailyDigest(type: DigestType): Promise<InstagramDigest | null> {
  log.info({ type }, '📰 Günlük Instagram bülteni oluşturma süreci başladı');

  // Bugünün başlangıcı (00:00:00)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 1. SADECE BUGÜN X'TE YAYINLANMIŞ (publishedTweets'te kaydı olan)
  // ve henüz bültende yer almamış haberleri çek:
  const candidates = await db
    .select({
      id: processedArticles.id,
      tweetText: processedArticles.tweetText,
      translatedTitle: processedArticles.translatedTitle,
      category: processedArticles.category,
      score: processedArticles.score,
      status: processedArticles.status,
      createdAt: processedArticles.createdAt,
      rawTitle: rawArticles.title,
      rawUrl: rawArticles.url,
      rawArticleId: rawArticles.id,
      rawImageUrl: rawArticles.imageUrl,
      rawPublishedAt: rawArticles.publishedAt,
      sourceName: sources.name,
      tweetPublishedAt: publishedTweets.publishedAt,
    })
    .from(processedArticles)
    .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .innerJoin(publishedTweets, eq(publishedTweets.processedId, processedArticles.id))
    .leftJoin(sources, eq(rawArticles.sourceId, sources.id))
    .where(
      and(
        eq(processedArticles.status, 'published'),
        eq(processedArticles.includedInDigest, false),
        gte(publishedTweets.publishedAt, todayStart), // SADECE BUGÜN X'TE YAYINLANANLAR!
      ),
    )
    .orderBy(desc(publishedTweets.publishedAt)) // En son yayınlanandan eskiye
    .limit(7); // Maksimum 7 haber (ideal 20-30 saniye Reels bülteni)

  if (candidates.length === 0) {
    log.info({ type }, 'Bülten için bugün X\'te yayınlanmış yeni haber bulunamadı, bülten atlanıyor.');
    return null;
  }

  log.info(
    {
      type,
      count: candidates.length,
      articles: candidates.map((c) => ({ id: c.id, title: getTurkishHeadline(c), publishedAt: c.tweetPublishedAt })),
    },
    'Bülten için X\'te bugün yayınlanan onaylı haberler seçildi',
  );

  const totalSlides = candidates.length;
  const slideImages: string[] = [];

  // 2. Her haber için numaralandırılmış Türkçe 9:16 kart üret
  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i]!;
    const slideIndex = i + 1;
    const turkishTitle = getTurkishHeadline(item);

    // Eğer RSS'ten görsel gelmemişse sayfanın OpenGraph görselini çek (Fallback)
    let slideImageUrl = item.rawImageUrl;
    if (!slideImageUrl && item.rawUrl) {
      try {
        const { extractOpenGraphImage } = await import('../processor/downloader.js');
        const ogImage = await extractOpenGraphImage(item.rawUrl);
        if (ogImage) {
          slideImageUrl = ogImage;
          await db
            .update(rawArticles)
            .set({ imageUrl: ogImage })
            .where(eq(rawArticles.id, item.rawArticleId))
            .catch(() => {});
        }
      } catch (ogErr: any) {
        log.warn({ err: ogErr.message, url: item.rawUrl }, 'Bülten için OpenGraph görseli çekilemedi');
      }
    }

    try {
      const cardPath = await generateDigestSlideCard({
        title: turkishTitle,
        sourceName: item.sourceName || 'Haber',
        category: (item.category as ArticleCategory) || 'general',
        publishedAt: item.rawPublishedAt || item.createdAt,
        articleId: item.id,
        imageUrl: slideImageUrl,
        slideIndex,
        totalSlides,
        digestType: type,
      });
      slideImages.push(cardPath);
    } catch (cardErr: any) {
      log.error({ err: cardErr.message, articleId: item.id }, 'Slayt kartı üretilemedi');
    }
  }

  if (slideImages.length === 0) {
    throw new Error('Hiçbir slayt kartı üretilemedi, bülten iptal edildi.');
  }

  // 3. FFmpeg ile video derle
  const videoOutputDir = path.join(process.cwd(), 'output', 'videos');
  if (!existsSync(videoOutputDir)) {
    await mkdir(videoOutputDir, { recursive: true });
  }

  const digestId = crypto.randomUUID();
  const outputVideoPath = path.join(videoOutputDir, `digest_${digestId}.mp4`);

  await generateDigestReel(slideImages, outputVideoPath);

  // 4. Gemini ile ortak Türkçe Instagram açıklaması (caption) üret
  const caption = await generateDigestCaption(
    candidates.map((c) => ({
      title: getTurkishHeadline(c),
      category: c.category ?? undefined,
      sourceName: c.sourceName ?? undefined,
      tweetText: c.tweetText,
    })),
    type,
  );

  // 5. Veritabanına kaydet
  const [newDigest] = await db
    .insert(instagramDigests)
    .values({
      id: digestId,
      type,
      articleIds: candidates.map((c) => c.id),
      videoPath: outputVideoPath,
      caption,
      status: 'pending',
    })
    .returning();

  if (!newDigest) {
    throw new Error('Bülten veritabanına kaydedilemedi');
  }

  // 6. Telegram onayına gönder
  await sendDigestApprovalRequest({
    digestId: newDigest.id,
    type,
    articleCount: candidates.length,
    videoPath: outputVideoPath,
    caption,
  });

  log.info({ digestId: newDigest.id, type, count: candidates.length }, '✅ Bülten hazırlandı ve Telegram onayına sunuldu');
  return newDigest;
}

/**
 * Onaylanan bülteni Instagram'a yayınlar ve kapsanan haberleri işaretler.
 */
export async function publishDigest(digestId: string): Promise<void> {
  log.info({ digestId }, '🚀 Bülten Instagram yayını başlıyor');

  const [digest] = await db
    .select()
    .from(instagramDigests)
    .where(eq(instagramDigests.id, digestId))
    .limit(1);

  if (!digest) {
    throw new Error(`Bülten bulunamadı: ${digestId}`);
  }

  if (digest.status === 'published') {
    log.info({ digestId }, 'Bülten zaten yayınlanmış, atlanıyor');
    return;
  }

  try {
    // 1. Instagram'a Reels olarak yükle
    const igResult = await postToInstagram(
      digest.caption,
      [], // Hashtag'ler zaten caption içinde
      digest.videoPath,
    );

    // 2. Bülten durumunu 'published' yap
    await db
      .update(instagramDigests)
      .set({
        status: 'published',
        igMediaId: igResult.igMediaId,
        igPostUrl: igResult.igPostUrl,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instagramDigests.id, digestId));

    // 3. Kapsanan makaleleri bültende kullanıldı olarak işaretle
    if (digest.articleIds && digest.articleIds.length > 0) {
      await db
        .update(processedArticles)
        .set({ includedInDigest: true, updatedAt: new Date() })
        .where(inArray(processedArticles.id, digest.articleIds));
    }

    log.info({ digestId, igMediaId: igResult.igMediaId, igPostUrl: igResult.igPostUrl }, '✅ Bülten Instagram\'da başarıyla yayınlandı');
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ err: errMsg, digestId }, '❌ Bülten Instagram yayını başarısız');

    await db
      .update(instagramDigests)
      .set({
        status: 'failed',
        rejectionReason: errMsg.substring(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(instagramDigests.id, digestId))
      .catch(() => {});

    throw error;
  }
}

/**
 * Bülteni iptal eder / pas geçer.
 */
export async function rejectDigest(digestId: string): Promise<void> {
  log.info({ digestId }, '❌ Bülten pas geçildi / iptal edildi');

  await db
    .update(instagramDigests)
    .set({
      status: 'rejected',
      updatedAt: new Date(),
    })
    .where(eq(instagramDigests.id, digestId));
}
