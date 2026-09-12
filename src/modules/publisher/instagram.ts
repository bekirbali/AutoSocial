import axios from 'axios';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const log = createLogger('publisher:instagram');

export interface InstagramPostResult {
  igMediaId: string;
  igPostUrl: string;
}

/**
 * Aktif public URL'yi tespit eder.
 * Eğer lokalde cloudflared çalışıyorsa (127.0.0.1:20241/metrics), dinamik trycloudflare adresini otomatik çeker.
 * Bulamazsa env.APP_PUBLIC_URL veya process.env.APP_PUBLIC_URL'e fallback yapar.
 */
async function getEffectivePublicUrl(): Promise<string> {
  try {
    const res = await axios.get('http://127.0.0.1:20241/metrics', { timeout: 1500 });
    const match = (res.data as string).match(/userHostname="(https:\/\/[^"]+\.trycloudflare\.com)"/);
    if (match && match[1]) {
      log.info({ activeTunnelUrl: match[1] }, '🌐 Cloudflared metriğinden aktif tünel URL otomatik algılandı');
      return match[1];
    }
  } catch {
    // Cloudflared metrics portu kapalıysa veya çalışmıyorsa sessizce geç
  }

  const envUrl = process.env.APP_PUBLIC_URL || env.APP_PUBLIC_URL;
  if (envUrl) {
    return envUrl;
  }

  throw new Error("APP_PUBLIC_URL eksik, görsel/video URL'si oluşturulamıyor");
}

/**
 * Instagram'a gönderi paylaş (Görsel + Metin)
 */
export async function postToInstagram(
  caption: string,
  hashtags: string[],
  mediaPath: string,
): Promise<InstagramPostResult> {
  const token = env.IG_ACCESS_TOKEN;
  const igUserId = env.IG_ACCOUNT_ID;
  const publicAppUrl = await getEffectivePublicUrl();

  if (!token || !igUserId) {
    throw new Error('IG_ACCESS_TOKEN veya IG_ACCOUNT_ID eksik');
  }

  if (!mediaPath || !existsSync(mediaPath)) {
    throw new Error(`Medya bulunamadı: ${mediaPath}`);
  }

  let finalMediaPath = mediaPath;
  const isVideo = finalMediaPath.toLowerCase().endsWith('.mp4');

  if (!isVideo) {
    // Eğer Instagram için özel üretilmiş 4:5 formatında görsel varsa onu tercih et
    const path4x5 = finalMediaPath.replace('_16x9', '_4x5');
    if (existsSync(path4x5)) {
      finalMediaPath = path4x5;
      log.info({ original: mediaPath, new: finalMediaPath }, 'Instagram için 4:5 formatı kullanılıyor');
    }

    // Instagram Graph API sadece JPEG kabul ediyor, webp gelirse on the fly dönüştür
    if (finalMediaPath.toLowerCase().endsWith('.webp')) {
      const jpegPath = finalMediaPath.replace(/\.webp$/i, '.jpeg');
      if (!existsSync(jpegPath)) {
        log.info({ original: finalMediaPath, new: jpegPath }, 'Instagram için .webp görseli .jpeg formatına dönüştürülüyor');
        await sharp(finalMediaPath).jpeg({ quality: 90 }).toFile(jpegPath);
      }
      finalMediaPath = jpegPath;
    }
  }

  // Sadece dosya adını al ve public URL'ye çevir
  const fileName = path.basename(finalMediaPath);
  // URL'yi /images/ veya /videos/ olarak ayarla (Statik sunucunun yapılandırmasına göre ikisi de output klasörüne yönlendirmelidir,
  // ama biz şu an main.ts'de sadece /images/ yolunu dinliyoruz, o yüzden main.ts'yi de güncellemeliyiz. Şimdilik medya için genel bir yol varsayalım)
  const mediaUrl = isVideo 
    ? `${publicAppUrl.replace(/\/$/, '')}/videos/${fileName}`
    : `${publicAppUrl.replace(/\/$/, '')}/images/${fileName}`;

  const hashtagStr = hashtags.join(' ');
  const fullCaption = hashtagStr ? `${caption}\n\n${hashtagStr}` : caption;

  log.info({ mediaUrl, isVideo, captionLength: fullCaption.length }, "Instagram'a gönderiliyor");

  try {
    // 1. Container oluştur
    const containerParams: any = {
      caption: fullCaption,
      access_token: token,
    };

    if (isVideo) {
      containerParams.media_type = 'REELS';
      containerParams.video_url = mediaUrl;
      containerParams.share_to_feed = true; // Hem Reels sekmesinde hem Profil akışında görünsün
    } else {
      containerParams.image_url = mediaUrl;
    }

    const containerRes = await axios.post(
      `https://graph.facebook.com/v21.0/${igUserId}/media`,
      null,
      { params: containerParams }
    );

    const creationId = containerRes.data.id;
    if (!creationId) {
      throw new Error('Instagram media container oluşturulamadı');
    }

    log.debug({ creationId }, 'Instagram media container oluşturuldu');

    // Eğer video ise (Reels) Meta sunucularında işlenmesini bekle
    if (isVideo) {
      log.info({ creationId }, 'Reels videosunun Meta sunucularında işlenmesi bekleniyor...');
      await waitForMediaContainerReady(creationId, token);
    }

    // 2. Container'ı yayınla
    const publishRes = await axios.post(
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: token,
        },
      }
    );

    const mediaId = publishRes.data.id;
    
    // (Opsiyonel) Permalink almak
    let permalink = `https://instagram.com/p/${mediaId}`; // Fallback
    try {
      const mediaDetailsRes = await axios.get(
        `https://graph.facebook.com/v21.0/${mediaId}`,
        {
          params: {
            fields: 'permalink',
            access_token: token,
          },
        }
      );
      if (mediaDetailsRes.data.permalink) {
        permalink = mediaDetailsRes.data.permalink;
      }
    } catch (e) {
      log.warn('Permalink alınamadı, fallback kullanılıyor');
    }

    log.info({ mediaId, permalink }, '✅ Instagram gönderisi atıldı');

    return { igMediaId: mediaId, igPostUrl: permalink };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    log.error({ err: errorMsg }, 'Instagram yayınlama başarısız');
    throw new Error(`Instagram Yayınlama Hatası: ${errorMsg}`);
  }
}

/**
 * Reels videosunun Meta Graph API sunucularında kodlanmasını ve hazır olmasını bekler
 */
async function waitForMediaContainerReady(
  creationId: string,
  token: string,
  maxAttempts = 20,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const statusRes = await axios.get(`https://graph.facebook.com/v21.0/${creationId}`, {
        params: {
          fields: 'status_code,status',
          access_token: token,
        },
      });

      const statusCode = statusRes.data?.status_code;
      log.debug({ creationId, statusCode, attempt }, 'Instagram Reels container durumu kontrol ediliyor');

      if (statusCode === 'FINISHED') {
        log.info({ creationId, attempt }, '✅ Instagram Reels container hazır');
        return;
      }

      if (statusCode === 'ERROR') {
        throw new Error(`Instagram Reels video işleme hatası: ${statusRes.data?.status ?? 'Bilinmeyen hata'}`);
      }

      if (statusCode === 'EXPIRED') {
        throw new Error('Instagram Reels video container süresi doldu (EXPIRED)');
      }
    } catch (err: any) {
      if (err.message?.includes('Instagram Reels')) {
        throw err;
      }
      log.warn({ err: err.message, attempt }, 'Container durumu sorgulanamadı, tekrar deneniyor...');
    }

    // IN_PROGRESS: 4 saniye bekle
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  throw new Error(`Instagram Reels container ${maxAttempts * 4} saniye içinde hazır olmadı (Timeout)`);
}

