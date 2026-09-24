import { Router } from 'express';
import { db } from '../../db/index.js';
import {
  processedArticles,
  rawArticles,
  sources,
  publishedTweets,
  instagramDigests,
} from '../../db/schema.js';
import { eq, and, desc, gte, inArray } from 'drizzle-orm';
import { getTurkishHeadline, publishDigest, getDigestCutoffTime } from '../../modules/publisher/digestManager.js';
import { generateDigestSlideCard } from '../../modules/processor/image.js';
import type { ArticleCategory } from '../../config/keywords.js';
import { generateDigestReel } from '../../modules/processor/digestGenerator.js';
import { generateDigestCaption } from '../../modules/processor/ai.js';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('server:routes:digest');
export const digestRouter: Router = Router();

// ─── 1. Bülten Adaylarını Getir (Akıllı Zaman Filtresi) ──────────────────────
digestRouter.get('/candidates', async (req, res) => {
  try {
    const hoursParam = req.query.hours ? parseFloat(String(req.query.hours)) : undefined;
    const { since, description, source } = await getDigestCutoffTime(hoursParam);

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
        tweetUrl: publishedTweets.tweetUrl,
      })
      .from(processedArticles)
      .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
      .innerJoin(publishedTweets, eq(publishedTweets.processedId, processedArticles.id))
      .leftJoin(sources, eq(rawArticles.sourceId, sources.id))
      .where(
        and(
          eq(processedArticles.status, 'published'),
          eq(processedArticles.includedInDigest, false),
          gte(publishedTweets.publishedAt, since),
        ),
      )
      .orderBy(desc(publishedTweets.publishedAt))
      .limit(15);

    const formatted = candidates.map((c) => ({
      ...c,
      displayTitle: getTurkishHeadline(c),
    }));

    // Redis'te panelden kaydedilmiş özel sıralama var mı kontrol et
    let orderedFormatted = formatted;
    try {
      const { redis } = await import('../../lib/redis.js');
      const customOrderJson = await redis.get('digest:custom_order');
      if (customOrderJson) {
        const customOrderIds: string[] = JSON.parse(customOrderJson);
        if (Array.isArray(customOrderIds) && customOrderIds.length > 0) {
          const candidateMap = new Map(formatted.map((c) => [c.id, c]));
          const sorted: typeof formatted = [];

          for (const id of customOrderIds) {
            const item = candidateMap.get(id);
            if (item) {
              sorted.push(item);
              candidateMap.delete(id);
            }
          }

          for (const item of formatted) {
            if (candidateMap.has(item.id)) {
              sorted.push(item);
            }
          }

          orderedFormatted = sorted;
        }
      }
    } catch (redisErr: any) {
      log.warn({ err: redisErr.message }, 'Adaylar sıralanırken Redis okunamadı');
    }

    res.json({
      success: true,
      cutoff: {
        since: since.toISOString(),
        description,
        source,
      },
      data: orderedFormatted,
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Bülten adayları getirilemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 1.1 Panelden Belirlenen Haber Sıralamasını Kaydet ─────────────────────────
digestRouter.post('/order', async (req, res): Promise<void> => {
  const { articleIds } = req.body;
  if (!articleIds || !Array.isArray(articleIds)) {
    res.status(400).json({ success: false, error: 'Geçersiz articleIds listesi' });
    return;
  }

  try {
    const { redis } = await import('../../lib/redis.js');
    await redis.set('digest:custom_order', JSON.stringify(articleIds), 'EX', 7 * 86400);
    log.info({ count: articleIds.length }, 'Bülten aday sıralaması Redis\'e kaydedildi');
    res.json({ success: true, message: 'Sıralama başarıyla kaydedildi' });
  } catch (err: any) {
    log.error({ err: err.message }, 'Bülten sıralaması kaydedilemedi');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 2. Bülteni Görsel Olarak Derle (Reels Video & Caption Üret) ──────────────
digestRouter.post('/compose', async (req, res): Promise<void> => {
  const { articleIds, digestType = 'manual' } = req.body;

  if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
    res.status(400).json({ success: false, error: 'En az bir haber seçilmelidir' });
    return;
  }

  if (articleIds.length > 7) {
    res.status(400).json({ success: false, error: 'Bültende en fazla 7 haber yer alabilir' });
    return;
  }

  try {
    // 1. Seçilen haberleri veritabanından çek
    const articles = await db
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
      .where(inArray(processedArticles.id, articleIds));

    // Kullanıcının panelden belirlediği sıralamayı (order) koru
    const orderedArticles = articleIds
      .map((id) => articles.find((a) => a.id === id))
      .filter(Boolean) as typeof articles;

    if (orderedArticles.length === 0) {
      res.status(404).json({ success: false, error: 'Seçilen haberler bulunamadı' });
      return;
    }

    const totalSlides = orderedArticles.length;
    const slideImages: string[] = [];

    // 2. Her haber için 9:16 slayt kartı üret
    for (let i = 0; i < orderedArticles.length; i++) {
      const item = orderedArticles[i]!;
      const slideIndex = i + 1;
      const turkishTitle = getTurkishHeadline(item);

      // Yüksek çözünürlüklü görsel çözümü (HD yükseltme veya OpenGraph fallback)
      let slideImageUrl = item.rawImageUrl;
      let slideImageBuffer: Buffer | null = null;
      try {
        const { resolveHighResImage } = await import('../../modules/processor/downloader.js');
        const resolved = await resolveHighResImage(slideImageUrl, item.rawUrl);
        if (resolved.url && resolved.url !== slideImageUrl) {
          slideImageUrl = resolved.url;
          await db
            .update(rawArticles)
            .set({ imageUrl: resolved.url })
            .where(eq(rawArticles.id, item.rawArticleId))
            .catch(() => {});
        }
        slideImageBuffer = resolved.buffer;
      } catch {
        // fallback sessizce atla
      }

      const cardPath = await generateDigestSlideCard({
        title: turkishTitle,
        sourceName: item.sourceName || 'Haber',
        category: (item.category as ArticleCategory) || 'general',
        publishedAt: item.rawPublishedAt || item.createdAt,
        articleId: item.id,
        imageUrl: slideImageUrl,
        articleUrl: item.rawUrl,
        preloadedBuffer: slideImageBuffer,
        slideIndex,
        totalSlides,
        digestType,
      });

      slideImages.push(cardPath);
    }

    // 3. FFmpeg ile MP4 Video Derle
    const videoOutputDir = path.join(process.cwd(), 'output', 'videos');
    if (!existsSync(videoOutputDir)) {
      await mkdir(videoOutputDir, { recursive: true });
    }

    const digestId = crypto.randomUUID();
    const outputVideoPath = path.join(videoOutputDir, `digest_${digestId}.mp4`);

    await generateDigestReel(slideImages, outputVideoPath);

    // 4. Gemini ile Instagram Açıklaması Üret
    const caption = await generateDigestCaption(
      orderedArticles.map((c) => ({
        title: getTurkishHeadline(c),
        category: c.category ?? undefined,
        sourceName: c.sourceName ?? undefined,
        tweetText: c.tweetText,
      })),
      digestType,
    );

    // 5. Veritabanına kaydet (Status: pending)
    const [savedDigest] = await db
      .insert(instagramDigests)
      .values({
        id: digestId,
        type: digestType,
        articleIds: orderedArticles.map((c) => c.id),
        videoPath: outputVideoPath,
        caption,
        status: 'pending',
      })
      .returning();

    // Seçilen haber sıralamasını Redis'e de işle
    try {
      const { redis } = await import('../../lib/redis.js');
      await redis.set('digest:custom_order', JSON.stringify(orderedArticles.map((c) => c.id)), 'EX', 7 * 86400);
    } catch {}

    const videoFileName = path.basename(outputVideoPath);
    res.json({
      success: true,
      data: {
        digestId,
        videoUrl: `/videos/${videoFileName}`,
        caption,
        status: savedDigest?.status,
        articleCount: orderedArticles.length,
        slides: slideImages.map((s) => `/images/${path.basename(s)}`),
      },
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Bülten derleme hatası');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 2.1 Derlenmiş Bülteni Telegram Onayına Gönder ──────────────────────────
digestRouter.post('/:id/send-telegram', async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const [digest] = await db
      .select()
      .from(instagramDigests)
      .where(eq(instagramDigests.id, id))
      .limit(1);

    if (!digest) {
      res.status(404).json({ success: false, error: 'Bülten bulunamadı' });
      return;
    }

    const { sendDigestApprovalRequest } = await import('../../modules/telegram/bot.js');
    const sent = await sendDigestApprovalRequest({
      digestId: digest.id,
      type: (digest.type as any) || 'manual',
      articleCount: digest.articleIds.length,
      videoPath: digest.videoPath,
      caption: digest.caption,
      periodInfo: 'Panelden derlenen bülten',
    });

    if (sent) {
      res.json({ success: true, message: 'Bülten Telegram onayına gönderildi' });
    } else {
      res.status(500).json({ success: false, error: 'Telegram onay mesajı gönderilemedi' });
    }
  } catch (error: any) {
    log.error({ err: error.message, id }, 'Bülten Telegram\'a gönderilemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 3. Bülteni Instagram'a Yayınla ───────────────────────────────────────────
digestRouter.post('/:id/publish', async (req, res) => {
  const { id } = req.params;
  try {
    const igResult = await publishDigest(id);
    const { syncDigestStatusToTelegram } = await import('../../modules/telegram/bot.js');
    await syncDigestStatusToTelegram(id, 'published', igResult.igPostUrl).catch(() => {});
    res.json({
      success: true,
      message: 'Bülten Instagram Reels olarak başarıyla yayınlandı',
      data: igResult,
    });
  } catch (error: any) {
    log.error({ err: error.message, id }, 'Bülten yayınlama hatası');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 4. Bülten Geçmişi ───────────────────────────────────────────────────────
digestRouter.get('/history', async (_req, res) => {
  try {
    const list = await db
      .select()
      .from(instagramDigests)
      .orderBy(desc(instagramDigests.createdAt))
      .limit(20);

    const formatted = list.map((d) => ({
      ...d,
      videoUrl: d.videoPath ? `/videos/${path.basename(d.videoPath)}` : null,
    }));

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    log.error({ err: error.message }, 'Bülten geçmişi getirilemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});
