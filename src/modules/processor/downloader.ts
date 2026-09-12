import { createLogger } from '../../lib/logger.js';

const log = createLogger('processor:downloader');

/**
 * Downloads an image from a URL and returns it as a Buffer.
 * Returns null if the download fails, timeouts, or the response is not an image.
 */
export async function downloadImage(url: string, timeoutMs: number = 8000): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some servers block requests without a User-Agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log.warn({ url, status: response.status }, 'Image download failed with non-2xx status');
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      log.warn({ url, contentType }, 'Downloaded content is not an image');
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.warn({ url, err: errMsg }, 'Image download threw an error (timeout or network)');
    return null;
  }
}

/**
 * Sayfa HTML'inden og:image veya twitter:image meta etiketini çıkarır.
 * RSS beslemesinde görsel sunmayan kaynaklar (örn: SamMobile) için fallback sağlar.
 */
export async function extractOpenGraphImage(pageUrl: string, timeoutMs: number = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

    if (ogMatch && ogMatch[1]) {
      log.info({ pageUrl, imageUrl: ogMatch[1] }, '🖼️ Sayfa HTML\'inden OpenGraph görseli çıkarıldı');
      return ogMatch[1];
    }
    return null;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.debug({ pageUrl, err: errMsg }, 'OpenGraph görseli çıkarılamadı');
    return null;
  }
}

