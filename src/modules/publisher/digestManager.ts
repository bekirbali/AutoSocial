import { db } from '../../db/index.js';
import {
  processedArticles,
  rawArticles,
  sources,
  instagramDigests,
  publishedTweets,
  type InstagramDigest,
} from '../../db/schema.js';
import { eq, and, desc, inArray, gte, isNotNull } from 'drizzle-orm';
import { generateDigestSlideCard } from '../processor/image.js';
import { generateDigestReel } from '../processor/digestGenerator.js';
import { generateDigestCaption, generateReelsDigestScript } from '../processor/ai.js';
import { generateSegmentedVoiceoverWithSubtitles } from '../processor/ttsService.js';
import { postToInstagram } from './instagram.js';
import { sendDigestApprovalRequest, sendDigestErrorReport } from '../telegram/bot.js';
import { createLogger } from '../../lib/logger.js';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import type { ArticleCategory } from '../../config/keywords.js';

const log = createLogger('publisher:digestManager');

export type DigestType = 'noon' | 'evening' | 'manual';

export interface DigestCutoffInfo {
  since: Date;
  description: string;
  source: 'custom_hours' | 'last_digest' | 'max_lookback_24h' | 'fallback_24h';
}

/**
 * Bülten için haber başlangıç zamanını (cutoff time) akıllıca belirler.
 * Mantık:
 * 1. Eğer customHours verilmişse -> now - customHours saat.
 * 2. En son başarıyla yayınlanmış bülten (status = 'published') varsa -> publishedAt zamanı.
 *    - Güvenlik önlemi (Fail-safe): Eğer son bülten 24 saatten daha eskiyse (örn. bakım/tatil),
 *      haberlerin bayatlamaması için en fazla 24 saat geriye gider (now - 24h).
 * 3. Eğer sistemde henüz hiç yayınlanmış bülten yoksa -> now - 24h (ilk kurulum fallback'i).
 */
export async function getDigestCutoffTime(customHours?: number): Promise<DigestCutoffInfo> {
  const now = new Date();

  if (customHours && customHours > 0) {
    const since = new Date(now.getTime() - customHours * 60 * 60 * 1000);
    return {
      since,
      description: `Son ${customHours} saat (${since.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'den itibaren)`,
      source: 'custom_hours',
    };
  }

  // Son yayınlanmış bülteni sorgula
  const [lastPublished] = await db
    .select({ publishedAt: instagramDigests.publishedAt })
    .from(instagramDigests)
    .where(and(eq(instagramDigests.status, 'published'), isNotNull(instagramDigests.publishedAt)))
    .orderBy(desc(instagramDigests.publishedAt))
    .limit(1);

  const maxLookbackMs = 24 * 60 * 60 * 1000; // En fazla 24 saat
  const maxLookbackDate = new Date(now.getTime() - maxLookbackMs);

  if (lastPublished?.publishedAt) {
    const lastPubDate = new Date(lastPublished.publishedAt);
    if (lastPubDate > maxLookbackDate) {
      const timeStr = lastPubDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const dateStr = lastPubDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
      return {
        since: lastPubDate,
        description: `Son bültenden bu yana (${dateStr} ${timeStr})`,
        source: 'last_digest',
      };
    }
    return {
      since: maxLookbackDate,
      description: `Son 24 saat (Önceki bülten 24 saatten eski olduğu için taze haber filtresi devrede)`,
      source: 'max_lookback_24h',
    };
  }

  return {
    since: maxLookbackDate,
    description: `Son 24 saat (Henüz yayınlanmış bülten bulunmadığı için)`,
    source: 'fallback_24h',
  };
}

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
export async function createDailyDigest(type: DigestType, customHours?: number): Promise<InstagramDigest | null> {
  const { since, description } = await getDigestCutoffTime(customHours);
  log.info({ type, since: since.toISOString(), description }, '📰 Günlük Instagram bülteni oluşturma süreci başladı');

  // 1. Belirlenen zamandan bu yana X'TE YAYINLANMIŞ (publishedTweets'te kaydı olan)
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
        gte(publishedTweets.publishedAt, since),
      ),
    )
    .orderBy(desc(publishedTweets.publishedAt)) // En son yayınlanandan eskiye
    .limit(15); // Aday havuzu

  if (candidates.length === 0) {
    log.info({ type, description }, 'Bülten için belirtilen aralıkta yeni haber bulunamadı, bülten atlanıyor.');
    return null;
  }

  // 1.1 Redis'ten panelde belirlenen özel bir haber sıralaması var mı kontrol et
  let orderedCandidates = candidates;
  try {
    const { redis } = await import('../../lib/redis.js');
    const customOrderJson = await redis.get('digest:custom_order');
    if (customOrderJson) {
      const customOrderIds: string[] = JSON.parse(customOrderJson);
      if (Array.isArray(customOrderIds) && customOrderIds.length > 0) {
        const candidateMap = new Map(candidates.map((c) => [c.id, c]));
        const sorted: typeof candidates = [];

        // Önce kullanıcının belirlediği sıradaki haberleri ekle
        for (const id of customOrderIds) {
          const item = candidateMap.get(id);
          if (item) {
            sorted.push(item);
            candidateMap.delete(id);
          }
        }

        // Özel sıralamada yer almayan diğer yeni haberleri tarihe göre arkasına ekle
        for (const item of candidates) {
          if (candidateMap.has(item.id)) {
            sorted.push(item);
          }
        }

        orderedCandidates = sorted;
        log.info(
          { customOrderCount: customOrderIds.length, finalCount: orderedCandidates.length },
          'Panelde belirlenen özel haber sıralaması bültene uygulandı',
        );
      }
    }
  } catch (err: any) {
    log.warn({ err: err.message }, 'Redis digest:custom_order okunamadı, varsayılan tarih sırası kullanılıyor');
  }

  // Maksimum 7 haber al
  orderedCandidates = orderedCandidates.slice(0, 7);

  log.info(
    {
      type,
      cutoff: description,
      count: orderedCandidates.length,
      articles: orderedCandidates.map((c) => ({ id: c.id, title: getTurkishHeadline(c), publishedAt: c.tweetPublishedAt })),
    },
    'Bülten için X\'te onaylanan haberler seçildi',
  );

  const successfulCandidates: typeof orderedCandidates = [];
  const slideImages: string[] = [];

  // 2. Her haber için numaralandırılmış Türkçe 9:16 kart üret
  for (let i = 0; i < orderedCandidates.length; i++) {
    const item = orderedCandidates[i]!;
    const turkishTitle = getTurkishHeadline(item);

    // Yüksek çözünürlüklü görsel çözümü (HD yükseltme veya OpenGraph fallback)
    let slideImageUrl = item.rawImageUrl;
    let slideImageBuffer: Buffer | null = null;
    try {
      const { resolveHighResImage } = await import('../processor/downloader.js');
      const resolved = await resolveHighResImage(slideImageUrl, item.rawUrl, turkishTitle || item.rawTitle);
      if (resolved.url && resolved.url !== slideImageUrl) {
        slideImageUrl = resolved.url;
        await db
          .update(rawArticles)
          .set({ imageUrl: resolved.url })
          .where(eq(rawArticles.id, item.rawArticleId))
          .catch(() => {});
      }
      slideImageBuffer = resolved.buffer;
    } catch (ogErr: any) {
      log.warn({ err: ogErr.message, url: item.rawUrl }, 'Bülten görseli çözümlenemedi');
    }

    try {
      const cardPath = await generateDigestSlideCard({
        title: turkishTitle,
        sourceName: item.sourceName || 'Haber',
        category: (item.category as ArticleCategory) || 'general',
        publishedAt: item.rawPublishedAt || item.createdAt,
        articleId: item.id,
        imageUrl: slideImageUrl,
        articleUrl: item.rawUrl,
        preloadedBuffer: slideImageBuffer,
        slideIndex: successfulCandidates.length + 1,
        totalSlides: orderedCandidates.length,
        digestType: type,
      });

      if (cardPath && existsSync(cardPath)) {
        slideImages.push(cardPath);
        successfulCandidates.push(item);
      }
    } catch (cardErr: any) {
      log.error({ err: cardErr.message, articleId: item.id }, 'Slayt kartı üretilemedi');
    }
  }

  // Koruma Katmanı: Reels bülteni için en az 2 slayt kartı başarıyla üretilmiş olmalıdır
  if (slideImages.length < 2 || successfulCandidates.length < 2) {
    log.warn(
      { slideCount: slideImages.length, candidateCount: orderedCandidates.length },
      '⚠️ Reels bülteni için yeterli geçerli slayt üretilemedi (en az 2 slayt gereklidir), bülten pas geçiliyor',
    );
    return null;
  }

  // 3. FFmpeg ile video derleme hazırlığı
  const videoOutputDir = path.join(process.cwd(), 'output', 'videos');
  if (!existsSync(videoOutputDir)) {
    await mkdir(videoOutputDir, { recursive: true });
  }

  const digestId = crypto.randomUUID();
  const outputVideoPath = path.join(videoOutputDir, `digest_${digestId}.mp4`);

  // 4. AI Spiker Metni ve Segmentli TTS Seslendirme + Karaoke Altyazı (Yalnızca başarılı slaytlar için)
  let voiceoverAudioPath: string | undefined;
  let subtitlesPath: string | undefined;
  let slideDurations: number[] | undefined;
  let totalDurationSeconds: number | undefined;

  try {
    const reelsScript = await generateReelsDigestScript(
      successfulCandidates.map((c) => ({
        title: getTurkishHeadline(c),
        category: c.category ?? undefined,
        sourceName: c.sourceName ?? undefined,
        tweetText: c.tweetText,
      })),
    );

    // Her slayt için tam segment metni hazırla.
    // Outro metnini son haberin slaytına iliştir ki son slayt ekrandayken outro da tamamlansın.
    const segments = reelsScript.segments.map((s, idx) => {
      const isLast = idx === reelsScript.segments.length - 1;
      const text = isLast && reelsScript.outroScript
        ? `${s.script} ${reelsScript.outroScript}`
        : s.script;
      return { text, articleIndex: s.articleIndex };
    });

    const ttsResult = await generateSegmentedVoiceoverWithSubtitles(segments, {
      baseFileName: `voice_${digestId}`,
      wordsPerCue: 3,
    });

    voiceoverAudioPath = ttsResult.masterAudioPath;
    subtitlesPath = ttsResult.masterAssPath; // Gerçek sarı boyamalı Karaoke ASS
    slideDurations = ttsResult.slideDurations; // Her slayt için tam seslendirme süresi
    totalDurationSeconds = ttsResult.totalDurationSeconds;
  } catch (ttsErr: any) {
    log.warn({ err: ttsErr.message }, 'Segmentli TTS veya Karaoke altyazı üretilemedi, standart müzikli video derlenecek');
    // Güvenli fallback süreleri: Slayt başına 5 saniye
    slideDurations = slideImages.map(() => 5);
    totalDurationSeconds = 5 * slideImages.length;
  }

  // 5. FFmpeg ile video derle (Slaytlar + TTS + Altyazı + Arka Plan Beat) — Hata Korumalı
  try {
    await generateDigestReel(slideImages, outputVideoPath, {
      voiceoverAudioPath,
      subtitlesPath,
      slideDurations,
      totalDurationSeconds,
    });
  } catch (renderErr: any) {
    log.error({ err: renderErr.message, digestId }, '❌ Reels FFmpeg derleme aşamasında hata oluştu');
    await sendDigestErrorReport(renderErr.message).catch(() => {});
    return null; // Queue job crash etmesin, güvenle sonlansın
  }

  // 6. Gemini ile ortak Türkçe Instagram açıklaması (caption) üret
  const caption = await generateDigestCaption(
    successfulCandidates.map((c) => ({
      title: getTurkishHeadline(c),
      category: c.category ?? undefined,
      sourceName: c.sourceName ?? undefined,
      tweetText: c.tweetText,
    })),
    type,
  );

  // 7. Veritabanına kaydet
  const [newDigest] = await db
    .insert(instagramDigests)
    .values({
      id: digestId,
      type,
      articleIds: successfulCandidates.map((c) => c.id),
      videoPath: outputVideoPath,
      caption,
      status: 'pending',
    })
    .returning();

  if (!newDigest) {
    throw new Error('Bülten veritabanına kaydedilemedi');
  }

  // 8. Telegram onayına gönder
  await sendDigestApprovalRequest({
    digestId: newDigest.id,
    type,
    articleCount: successfulCandidates.length,
    videoPath: outputVideoPath,
    caption,
    periodInfo: description,
  });

  log.info({ digestId: newDigest.id, type, count: successfulCandidates.length }, '✅ Bülten hazırlandı ve Telegram onayına sunuldu');
  return newDigest;
}

/**
 * Onaylanan bülteni Instagram'a yayınlar ve kapsanan haberleri işaretler.
 */
export async function publishDigest(digestId: string): Promise<{ igMediaId: string; igPostUrl: string }> {
  log.info({ digestId }, '🚀 Bülten Instagram yayını başlıyor');

  const [digest] = await db
    .select()
    .from(instagramDigests)
    .where(eq(instagramDigests.id, digestId))
    .limit(1);

  if (!digest) {
    throw new Error(`Bülten bulunamadı: ${digestId}`);
  }

  if (digest.status === 'published' && digest.igMediaId && digest.igPostUrl) {
    log.info({ digestId }, 'Bülten zaten yayınlanmış, atlanıyor');
    return {
      igMediaId: digest.igMediaId,
      igPostUrl: digest.igPostUrl,
    };
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

    // 4. Kullanılan özel sıralama hafızasını temizle
    try {
      const { redis } = await import('../../lib/redis.js');
      await redis.del('digest:custom_order');
    } catch {}

    log.info({ digestId, igMediaId: igResult.igMediaId, igPostUrl: igResult.igPostUrl }, '✅ Bülten Instagram\'da başarıyla yayınlandı');
    return igResult;
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
 * Eğer bülten Instagram'da zaten yayınlanmışsa veya bir mediaId varsa iptal edilmesini engeller.
 */
export async function rejectDigest(digestId: string): Promise<boolean> {
  log.info({ digestId }, '❌ Bülten pas geçme / iptal talebi alındı');

  const [digest] = await db
    .select({
      status: instagramDigests.status,
      igMediaId: instagramDigests.igMediaId,
    })
    .from(instagramDigests)
    .where(eq(instagramDigests.id, digestId))
    .limit(1);

  if (!digest) {
    log.warn({ digestId }, 'İptal edilecek bülten bulunamadı');
    return false;
  }

  if (digest.status === 'published' || digest.igMediaId) {
    log.warn({ digestId }, '⚠️ Bülten zaten Instagram\'da yayınlanmış olduğu için iptal edilemez!');
    return false;
  }

  await db
    .update(instagramDigests)
    .set({
      status: 'rejected',
      updatedAt: new Date(),
    })
    .where(eq(instagramDigests.id, digestId));

  return true;
}
