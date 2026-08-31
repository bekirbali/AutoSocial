import { createLogger } from '../../lib/logger.js';

const log = createLogger('publisher:rateLimiter');

export interface RateLimitState {
  remaining429RetryAfter: number | null;
  consecutiveErrors: number;
}

const state: RateLimitState = {
  remaining429RetryAfter: null,
  consecutiveErrors: 0,
};

const MAX_RETRIES = 3;

// Exponential backoff süreler (saniye)
const BACKOFF_SECONDS = [60, 120, 240];

/**
 * Rate limit farkında gönderim wrapper
 * 429 hatası → exponential backoff uygula
 * 4. denemede exception fırlat
 */
export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  // Aktif bir 429 bekleme süresi varsa bekle
  if (state.remaining429RetryAfter && state.remaining429RetryAfter > Date.now()) {
    const waitMs = state.remaining429RetryAfter - Date.now();
    log.warn({ waitMs }, 'Rate limit aktif, bekleniyor');
    await sleep(waitMs);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      // Başarılı — hata sayacını sıfırla
      state.consecutiveErrors = 0;
      state.remaining429RetryAfter = null;
      return result;
    } catch (error) {
      const is429 = isRateLimitError(error);

      if (is429) {
        const backoffMs = (BACKOFF_SECONDS[attempt] ?? 240) * 1000;
        state.remaining429RetryAfter = Date.now() + backoffMs;
        state.consecutiveErrors++;

        log.warn(
          { attempt: attempt + 1, backoffMs, consecutiveErrors: state.consecutiveErrors },
          `429 Rate limit — ${backoffMs / 1000}s bekleniyor`,
        );

        if (attempt < MAX_RETRIES - 1) {
          await sleep(backoffMs);
          continue;
        }
      }

      // 429 değil veya max retry aşıldı
      throw error;
    }
  }

  throw new Error('Rate limit: maksimum retry sayısı aşıldı');
}

/**
 * X API 429 hatasını tespit et
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests')
    );
  }

  // twitter-api-v2 ApiResponseError
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code: number }).code === 429 ||
           (error as { code: number }).code === 88;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
