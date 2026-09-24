import { Router } from 'express';
import { db } from '../../db/index.js';
import { processedArticles, rawArticles, sources, publishedTweets } from '../../db/schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { publishQueue, removePendingPublishJobs, type PublishJobData } from '../../lib/queue.js';
import { getNextPublishSlot } from '../../scheduler/cron.js';
import { generateNewsCard } from '../../modules/processor/image.js';
import { syncArticleStatusToTelegram } from '../../modules/telegram/bot.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('server:routes:articles');
export const articlesRouter: Router = Router();

// ─── 1. Makaleleri Listele ─────────────────────────────────────────────────────
articlesRouter.get('/', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const offset = Number(req.query.offset || 0);

    let query = db
      .select({
        id: processedArticles.id,
        score: processedArticles.score,
        tweetText: processedArticles.tweetText,
        translatedTitle: processedArticles.translatedTitle,
        category: processedArticles.category,
        status: processedArticles.status,
        imagePath: processedArticles.imagePath,
        videoPath: processedArticles.videoPath,
        instagramCaption: processedArticles.instagramCaption,
        platformTargets: processedArticles.platformTargets,
        includedInDigest: processedArticles.includedInDigest,
        createdAt: processedArticles.createdAt,
        updatedAt: processedArticles.updatedAt,
        rawTitle: rawArticles.title,
        rawUrl: rawArticles.url,
        rawImageUrl: rawArticles.imageUrl,
        rawPublishedAt: rawArticles.publishedAt,
        sourceName: sources.name,
        tweetId: publishedTweets.tweetId,
        tweetUrl: publishedTweets.tweetUrl,
        tweetPublishedAt: publishedTweets.publishedAt,
      })
      .from(processedArticles)
      .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
      .leftJoin(sources, eq(rawArticles.sourceId, sources.id))
      .leftJoin(publishedTweets, eq(publishedTweets.processedId, processedArticles.id))
      .orderBy(desc(processedArticles.createdAt))
      .limit(limit)
      .offset(offset);

    let items;
    if (status && status !== 'all') {
      items = await db
        .select({
          id: processedArticles.id,
          score: processedArticles.score,
          tweetText: processedArticles.tweetText,
          translatedTitle: processedArticles.translatedTitle,
          category: processedArticles.category,
          status: processedArticles.status,
          imagePath: processedArticles.imagePath,
          videoPath: processedArticles.videoPath,
          instagramCaption: processedArticles.instagramCaption,
          platformTargets: processedArticles.platformTargets,
          includedInDigest: processedArticles.includedInDigest,
          createdAt: processedArticles.createdAt,
          updatedAt: processedArticles.updatedAt,
          rawTitle: rawArticles.title,
          rawUrl: rawArticles.url,
          rawImageUrl: rawArticles.imageUrl,
          rawPublishedAt: rawArticles.publishedAt,
          sourceName: sources.name,
          tweetId: publishedTweets.tweetId,
          tweetUrl: publishedTweets.tweetUrl,
          tweetPublishedAt: publishedTweets.publishedAt,
        })
        .from(processedArticles)
        .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
        .leftJoin(sources, eq(rawArticles.sourceId, sources.id))
        .leftJoin(publishedTweets, eq(publishedTweets.processedId, processedArticles.id))
        .where(eq(processedArticles.status, status))
        .orderBy(desc(processedArticles.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      items = await query;
    }

    // Görsel yollarını web dostu URL formatına dönüştür
    const formatted = items.map((item) => {
      let imageUrl = null;
      if (item.imagePath) {
        const basename = item.imagePath.split(/[/\\]/).pop();
        imageUrl = `/images/${basename}`;
      }
      return {
        ...item,
        cardImageUrl: imageUrl,
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    log.error({ err: error.message }, 'Makaleler getirilemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 2. Makale Aksiyonları (Onayla / Sıraya Al / Reddet / Güncelle) ─────────────
articlesRouter.post('/:id/action', async (req, res): Promise<void> => {
  const { id } = req.params;
  const { action, tweetText, translatedTitle, targets = ['x'] } = req.body;

  try {
    const [article] = await db
      .select()
      .from(processedArticles)
      .where(eq(processedArticles.id, id))
      .limit(1);

    if (!article) {
      res.status(404).json({ success: false, error: 'Makale bulunamadı' });
      return;
    }

    if (action === 'publish_now') {
      // 1. Hemen Yayınla
      await db
        .update(processedArticles)
        .set({ status: 'approved', platformTargets: targets, updatedAt: new Date() })
        .where(eq(processedArticles.id, id));

      const jobData: PublishJobData = {
        processedArticleId: id,
        scheduledFor: new Date().toISOString(),
      };

      // Varsa eski job'ı kaldır (BullMQ aynı ID'li tamamlanmış/hatalı işi sessizce yutmasın)
      await removePendingPublishJobs(id);

      await publishQueue.add(`publish:${id}`, jobData, {
        delay: 0,
        jobId: `publish-${id}-${Date.now()}`,
      });

      // Telegram onay mesajını senkronize et
      syncArticleStatusToTelegram(id, 'published').catch(() => {});

      log.info({ articleId: id }, 'Panelden hemen yayınlama kuyruğuna alındı');
      res.json({ success: true, message: 'Makale hemen yayınlama kuyruğuna eklendi' });
      return;
    }

    if (action === 'schedule') {
      // 2. Sıraya Al (Boş Slota Zamanla)
      await db
        .update(processedArticles)
        .set({ status: 'approved', platformTargets: targets, updatedAt: new Date() })
        .where(eq(processedArticles.id, id));

      const publishAt = await getNextPublishSlot();
      const delayMs = Math.max(0, publishAt.getTime() - Date.now());

      const jobData: PublishJobData = {
        processedArticleId: id,
        scheduledFor: publishAt.toISOString(),
      };

      // Varsa eski job'ı kaldır
      await removePendingPublishJobs(id);

      await publishQueue.add(`publish:${id}`, jobData, {
        delay: delayMs,
        jobId: `publish-${id}-${Date.now()}`,
      });

      // Telegram onay mesajını senkronize et
      syncArticleStatusToTelegram(id, 'scheduled', { scheduledAt: publishAt }).catch(() => {});

      log.info({ articleId: id, publishAt: publishAt.toISOString() }, 'Panelden yayın sırasına alındı');
      res.json({
        success: true,
        message: `Makale ${publishAt.toLocaleTimeString('tr-TR')} için sıraya alındı`,
        scheduledFor: publishAt.toISOString(),
      });
      return;
    }

    if (action === 'reject') {
      // 3. Reddet
      await db
        .update(processedArticles)
        .set({
          status: 'rejected',
          rejectionReason: req.body.reason || 'Admin panelden reddedildi',
          updatedAt: new Date(),
        })
        .where(eq(processedArticles.id, id));

      // Kuyrukta bekleyen delayed iş varsa iptal et
      await removePendingPublishJobs(id);

      // Telegram onay mesajını senkronize et
      syncArticleStatusToTelegram(id, 'rejected').catch(() => {});

      log.info({ articleId: id }, 'Makale panelden reddedildi');
      res.json({ success: true, message: 'Makale reddedildi' });
      return;
    }

    if (action === 'update') {
      // 4. Metin Güncelle
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (tweetText !== undefined) updates.tweetText = tweetText.trim();
      if (translatedTitle !== undefined) updates.translatedTitle = translatedTitle.trim();

      await db
        .update(processedArticles)
        .set(updates)
        .where(eq(processedArticles.id, id));

      // Telegram onay mesajını senkronize et
      syncArticleStatusToTelegram(id, 'updated', { newText: tweetText }).catch(() => {});

      log.info({ articleId: id }, 'Makale metinleri güncellendi');
      res.json({ success: true, message: 'Makale başarıyla güncellendi' });
      return;
    }

    if (action === 'pre_approve') {
      // 5. Ön Onaya Al
      await db
        .update(processedArticles)
        .set({ status: 'pre_approved', updatedAt: new Date() })
        .where(eq(processedArticles.id, id));

      log.info({ articleId: id }, 'Makale ön onaya alındı');
      res.json({ success: true, message: 'Makale ön onaya alındı' });
      return;
    }

    if (action === 'un_pre_approve') {
      // 6. Ön Onaydan Çıkar (Onay Bekleyenler'e Geri Al)
      await db
        .update(processedArticles)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(eq(processedArticles.id, id));

      await removePendingPublishJobs(id);

      log.info({ articleId: id }, 'Makale tekrar onay bekleyenlere taşındı');
      res.json({ success: true, message: 'Makale onay bekleyenlere geri alındı' });
      return;
    }

    res.status(400).json({ success: false, error: 'Geçersiz aksiyon' });
    return;
  } catch (error: any) {
    log.error({ err: error.message, id }, 'Makale aksiyon hatası');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 3. Kart Canlı Yeniden Render (Sharp) ───────────────────────────────────────
articlesRouter.post('/:id/render-card', async (req, res): Promise<void> => {
  const { id } = req.params;
  const { title, imageUrl } = req.body;

  try {
    const [article] = await db
      .select({
        processed: processedArticles,
        raw: rawArticles,
        source: sources,
      })
      .from(processedArticles)
      .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
      .leftJoin(sources, eq(rawArticles.sourceId, sources.id))
      .where(eq(processedArticles.id, id))
      .limit(1);

    if (!article) {
      res.status(404).json({ success: false, error: 'Makale bulunamadı' });
      return;
    }

    const effectiveTitle = title || article.processed.translatedTitle;
    const effectiveImage = imageUrl || article.raw.imageUrl;

    const result = await generateNewsCard(
      effectiveTitle,
      article.source?.name || 'Haber',
      (article.processed.category as any) || 'general',
      article.raw.publishedAt || article.processed.createdAt,
      article.raw.id,
      '16:9',
      effectiveImage,
    );

    // processedArticles tablosunu güncelle
    await db
      .update(processedArticles)
      .set({
        imagePath: result.imagePath,
        imageSource: result.imageSource,
        translatedTitle: effectiveTitle,
        updatedAt: new Date(),
      })
      .where(eq(processedArticles.id, id));

    const basename = result.imagePath.split(/[/\\]/).pop();
    res.json({
      success: true,
      cardImageUrl: `/images/${basename}?t=${Date.now()}`,
    });
  } catch (error: any) {
    log.error({ err: error.message, id }, 'Kart render hatası');
    res.status(500).json({ success: false, error: error.message });
  }
});
