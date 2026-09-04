import { TwitterApi } from 'twitter-api-v2';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const log = createLogger('publisher:twitter');

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
 * Tweet metni + hashtag birleştir, karakter limitini kontrol et
 */
function buildTweetText(text: string, hashtags: string[]): string {
  const hashtagStr = hashtags.join(' ');
  const combined = hashtagStr ? `${text}\n\n${hashtagStr}` : text;

  // Twitter limiti 280 karakter (biz 240 + hashtaglar için pay bıraktık)
  if (combined.length > 280) {
    const truncated = text.substring(0, 280 - hashtagStr.length - 4) + '... ';
    return `${truncated}\n\n${hashtagStr}`;
  }

  return combined;
}
