import sharp from 'sharp';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('processor:downloader');

/**
 * URL'lerdeki HTML entity'lerini (&amp;, &#038;) çözer ve bilinen haber sitelerinin
 * thumbnail (küçük resim) parametrelerini yüksek çözünürlüklü (HD) orijinaline yükseltir.
 */
export function cleanAndUpgradeImageUrl(url: string): string {
  if (!url) return url;

  let clean = url
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/g, '&')
    .trim();

  // 1. GSMArena: /-184x111/ veya /-\d+x\d+[^/]*\// -> kaldırarak orijinal görseli al
  if (clean.includes('fdn.gsmarena.com')) {
    clean = clean.replace(/\/-[0-9]+x[0-9]+[^/]*\//, '/');
  }

  // 2. Gamer Network (Eurogamer, Rock Paper Shotgun): width=690 -> width=1200
  if (clean.includes('assetsio.gnwcdn.com')) {
    clean = clean.replace(/width=\d+/, 'width=1200').replace(/height=\d+/, 'height=675');
  }

  // 3. Webtekno: 640xauto -> 1200xauto
  if (clean.includes('imgrosetta.webtekno.com')) {
    clean = clean.replace(/-\d+xauto/, '-1200xauto');
  }

  // 4. Future CDN (Tom's Hardware, PC Gamer, TechRadar): küçük boyutları 1280px yap
  if (clean.includes('futurecdn.net')) {
    clean = clean.replace(/-\d{2,3}-80\.(jpg|jpeg|png|webp)/i, '-1280-80.$1');
  }

  // 5. WordPress standart thumbnail desenleri: image-150x150.jpg, image-300x200.jpg -> image.jpg
  if (clean.includes('/wp-content/uploads/')) {
    clean = clean.replace(/-\d{2,4}x\d{2,4}(\.[a-zA-Z]+(?:\?.*)?)$/, '$1');
  }

  return clean;
}

/**
 * URL'nin düşük çözünürlüklü bir thumbnail olup olmadığını tahmin eder.
 */
export function isSuspectedThumbnail(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('184x111') ||
    lower.includes('150x150') ||
    lower.includes('300x200') ||
    lower.includes('100x100') ||
    lower.includes('200x200') ||
    lower.includes('_thumb') ||
    lower.includes('thumb.') ||
    lower.includes('-thumb') ||
    lower.includes('crop=0,0,100,100')
  );
}

/**
 * Downloads an image from a URL and returns it as a Buffer.
 * Returns null if the download fails, timeouts, or the response is not an image.
 */
export async function downloadImage(url: string, timeoutMs: number = 8000): Promise<Buffer | null> {
  try {
    const targetUrl = cleanAndUpgradeImageUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        // Some servers block requests without a User-Agent
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log.warn({ url: targetUrl, status: response.status }, 'Image download failed with non-2xx status');
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      log.warn({ url: targetUrl, contentType }, 'Downloaded content is not an image');
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
 * URL'deki HTML varlıklarını temizler ve göreceli (relative) URL'leri mutlak hale getirir.
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
      html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i) ||
      html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);

    if (ogMatch && ogMatch[1]) {
      let rawImg = ogMatch[1].trim();
      // Göreceli URL düzeltmesi
      if (rawImg.startsWith('/')) {
        try {
          rawImg = new URL(rawImg, pageUrl).href;
        } catch {
          // ignore url parse error
        }
      }

      const upgraded = cleanAndUpgradeImageUrl(rawImg);
      log.info({ pageUrl, imageUrl: upgraded }, '🖼️ Sayfa HTML\'inden OpenGraph görseli çıkarıldı');
      return upgraded;
    }
    return null;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.debug({ pageUrl, err: errMsg }, 'OpenGraph görseli çıkarılamadı');
    return null;
  }
}

export interface ResolvedImageResult {
  buffer: Buffer | null;
  url: string | null;
  width?: number;
  height?: number;
  source: 'direct' | 'upgraded' | 'opengraph' | 'none';
}

/**
 * Haber için en yüksek çözünürlüklü ve kaliteli görseli bulur, indirir ve doğrular.
 *
 * Akış:
 * 1. Gelen URL'yi yükseltir (cleanAndUpgradeImageUrl).
 * 2. URL bir thumbnail ise veya yoksa, sayfanın OpenGraph görselini araştırır.
 * 3. Sharp ile boyut kontrolü yapar:
 *    - Eğer genişlik >= 500px ve yükseklik >= 250px ise yüksek kalite olarak kabul eder.
 *    - Eğer 450x250px'in altındaysa (uzatıldığında piksellenecekse) null döndürür
 *      (böylece Sharp şık SVG gradient şablonunu kullanır).
 */
export async function resolveHighResImage(
  initialImageUrl?: string | null,
  articleUrl?: string | null,
): Promise<ResolvedImageResult> {
  const initialUpgraded = initialImageUrl ? cleanAndUpgradeImageUrl(initialImageUrl) : null;
  const isThumb = initialUpgraded ? isSuspectedThumbnail(initialUpgraded) : true;

  // 1. Aday URL listesi oluştur
  const candidateUrls: Array<{ url: string; type: 'opengraph' | 'upgraded' | 'direct' }> = [];

  // Eğer URL şüpheli thumbnail ise veya hiç yoksa, önce OpenGraph'a öncelik ver
  let ogUrl: string | null = null;
  if ((!initialUpgraded || isThumb) && articleUrl) {
    ogUrl = await extractOpenGraphImage(articleUrl);
    if (ogUrl) {
      candidateUrls.push({ url: ogUrl, type: 'opengraph' });
    }
  }

  if (initialUpgraded) {
    candidateUrls.push({
      url: initialUpgraded,
      type: initialUpgraded !== initialImageUrl ? 'upgraded' : 'direct',
    });
  }

  // Eğer daha önce bakılmadıysa ve elimizdeki tek URL yetersiz çıkarsa diye OG fallback ekle
  if (!ogUrl && articleUrl) {
    // Lazy fallback için fonksiyon içi denenecek
  }

  for (const candidate of candidateUrls) {
    const buffer = await downloadImage(candidate.url);
    if (!buffer) continue;

    try {
      const meta = await sharp(buffer).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;

      // Kabul edilebilir kalite eşiği
      if (width >= 500 && height >= 250) {
        log.info(
          { url: candidate.url, width, height, type: candidate.type },
          '✅ Yüksek çözünürlüklü görsel doğrulandı',
        );
        return {
          buffer,
          url: candidate.url,
          width,
          height,
          source: candidate.type,
        };
      } else {
        log.warn(
          { url: candidate.url, width, height },
          '⚠️ Görsel boyutu düşük (thumbnail tespit edildi), alternatif araştırılıyor',
        );
      }
    } catch (sharpErr) {
      log.warn({ url: candidate.url, err: sharpErr }, 'Görsel metadata okunamadı');
    }
  }

  // Eğer elimizdeki ilk URL düşüktü ve OG henüz denenmediyse son çare OG dene
  if (!ogUrl && articleUrl) {
    const fallbackOg = await extractOpenGraphImage(articleUrl);
    if (fallbackOg) {
      const buffer = await downloadImage(fallbackOg);
      if (buffer) {
        try {
          const meta = await sharp(buffer).metadata();
          if ((meta.width ?? 0) >= 500 && (meta.height ?? 0) >= 250) {
            return {
              buffer,
              url: fallbackOg,
              width: meta.width,
              height: meta.height,
              source: 'opengraph',
            };
          }
        } catch {}
      }
    }
  }

  // Hiçbir kaliteli görsel bulunamadıysa (çamur gibi uzatmamak için null dönüyoruz)
  log.warn(
    { initialImageUrl, articleUrl },
    '🚫 Yeterli çözünürlükte görsel bulunamadı, şık gradient şablonuna yönlendiriliyor',
  );
  return { buffer: null, url: null, source: 'none' };
}
