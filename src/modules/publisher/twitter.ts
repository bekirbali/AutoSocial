import { TwitterApi } from 'twitter-api-v2';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { redis } from '../../lib/redis.js';

const log = createLogger('publisher:twitter');

/**
 * X Manuel Modunun aktif olup olmadığını Redis (ve fallback env) üzerinden kontrol eder.
 * Manuel Mod aktifken:
 * - X API'ye tweet atma isteği yapılmaz (0 TL maliyet)
 * - X API metrik okuma (Read) istekleri yapılmaz
 * - Yerel DB'de haber onaylanıp yayınlandı kabul edilir, böylece Instagram Reels bültenleri aksamaz.
 */
export async function isXManualMode(): Promise<boolean> {
  try {
    const val = await redis.get('setting:x_manual_mode');
    if (val !== null) {
      return val === 'true';
    }
  } catch {
    // Redis hatası durumunda env fallback
  }
  return env.X_MANUAL_MODE ?? false;
}

/**
 * X Manuel Modunu Redis üzerinden dinamik olarak açar veya kapatır.
 */
export async function setXManualMode(enabled: boolean): Promise<void> {
  await redis.set('setting:x_manual_mode', enabled ? 'true' : 'false');
  log.info(
    { enabled },
    `X (Twitter) yayınlama modu güncellendi: ${enabled ? '🖐 MANUEL MOD (X API Pasif - 0 TL)' : '⚡ OTOMATİK MOD (X API Aktif)'}`,
  );
}

// OAuth 1.0a ile kimlik doğrulama (tweet atma için zorunlu)
export const twitterClient = new TwitterApi({
  appKey: env.X_CONSUMER_KEY,
  appSecret: env.X_CONSUMER_KEY_SECRET,
  accessToken: env.X_ACCESS_TOKEN,
  accessSecret: env.X_ACCESS_TOKEN_SECRET,
});

// Read-only client (bearer token — rate limit kontrolü için)
export const twitterReadClient = new TwitterApi(env.X_BEARER_TOKEN);

export interface TweetPostResult {
  tweetId: string;
  tweetUrl: string;
}


/**
 * Tweet at + isteğe bağlı görsel ekle
 */
export async function postTweet(
  text: string,
  hashtags: string[],
  mediaPath?: string,
): Promise<TweetPostResult> {
  // Tweet metni + hashtag birleştir
  const fullText = buildTweetText(text, hashtags);

  log.info({ textLength: fullText.length }, 'Tweet atılıyor');

  let mediaId: string | undefined;

  // Medya varsa yükle
  if (mediaPath && existsSync(mediaPath)) {
    try {
      const isVideo = mediaPath.toLowerCase().endsWith('.mp4');
      
      // twitter-api-v2 string yol verilirse otomatik mime-type algılar ve büyük dosyalar için chunked upload yapar
      const uploaded = await twitterClient.v1.uploadMedia(mediaPath, isVideo ? { longVideo: true } : undefined);
      mediaId = uploaded;
      log.debug({ mediaId, isVideo }, 'Medya X sunucularına yüklendi');
    } catch (imgErr) {
      log.warn(
        { err: imgErr instanceof Error ? imgErr.message : imgErr },
        'Medya yüklenemedi, medyasız tweet atılıyor',
      );
    }
  }

  const tweet = await twitterClient.v2.tweet({
    text: fullText,
    ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
  });

  const tweetId = tweet.data.id;
  const tweetUrl = `https://x.com/i/web/status/${tweetId}`;

  log.info({ tweetId, tweetUrl }, '✅ Tweet atıldı');

  return { tweetId, tweetUrl };
}

/**
 * İlk yorum olarak link at (X algoritması dış link tweetleri bastırıyor)
 */
export async function postReply(
  tweetId: string,
  replyText: string,
): Promise<TweetPostResult> {
  const reply = await twitterClient.v2.tweet({
    text: replyText,
    reply: { in_reply_to_tweet_id: tweetId },
  });

  const replyId = reply.data.id;
  const replyUrl = `https://x.com/i/web/status/${replyId}`;

  log.debug({ tweetId, replyId }, 'Reply atıldı (link yorumu)');

  return { tweetId: replyId, tweetUrl: replyUrl };
}

/**
 * Kalan rate limit bilgisini çek
 */
export async function checkRateLimit(): Promise<{
  tweets: number;
  resetAt: Date | null;
}> {
  try {
    // twitter-api-v2 v2 client ile kalan rate limit doğrudan expose edilmiyor
    // Güvenli fallback: yüksek değer döndür (gerçek limit aşımında 429 yakalanır)
    return { tweets: 999, resetAt: null };
  } catch {
    // Rate limit bilgisi alınamadıysa güvenli değer döndür
    return { tweets: 999, resetAt: null };
  }
}

/**
 * Tweet metninin X (Twitter) ağırlıklı karakter uzunluğunu hesaplar.
 * Standart Latin karakterler 1, emojiler/CJK/semboller 2 ağırlık sayılır.
 */
export function getTwitterWeightedLength(text: string): number {
  let weight = 0;
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  for (const { segment } of segmenter.segment(text)) {
    const codePoint = segment.codePointAt(0) ?? 0;
    // Emojiler, semboller ve karmaşık karakterler Twitter'da 2 birim ağırlık tutar
    if (codePoint > 0x2000 || segment.length > 1) {
      weight += 2;
    } else {
      weight += 1;
    }
  }
  return weight;
}

/**
 * Tweet metnini Twitter'ın ağırlıklı limitine uygun şekilde güvenli kırpar.
 * Emojileri ve kelime bütünlüğünü korur.
 */
export function truncateToTwitterLimit(text: string, maxWeight: number = 265): string {
  if (getTwitterWeightedLength(text) <= maxWeight) return text;

  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  let result = '';
  let currentWeight = 0;
  const targetWeight = maxWeight - 3; // '...' için pay

  for (const { segment } of segmenter.segment(text)) {
    const codePoint = segment.codePointAt(0) ?? 0;
    const segWeight = (codePoint > 0x2000 || segment.length > 1) ? 2 : 1;
    if (currentWeight + segWeight > targetWeight) break;
    result += segment;
    currentWeight += segWeight;
  }

  // Kelime ortasında kesilmesini önlemek için son boşluğa kadar geri çek
  const lastSpace = result.lastIndexOf(' ');
  if (lastSpace > 100) {
    result = result.substring(0, lastSpace);
  }

  return `${result.trimEnd()}...`;
}

/**
 * Tweet metni + hashtag birleştir, karakter limitini kontrol et
 */
export function buildTweetText(text: string, hashtags: string[]): string {
  const hashtagStr = hashtags.join(' ');
  const combined = hashtagStr ? `${text}\n\n${hashtagStr}` : text;

  // Güvenli Twitter ağırlıklı limit: 265 karakter (280 sınırına karşı 15 birim emojili marj)
  return truncateToTwitterLimit(combined, 265);
}
