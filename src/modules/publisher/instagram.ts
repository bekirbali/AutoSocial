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
 * Instagram'a gönderi paylaş (Görsel + Metin)
 */
export async function postToInstagram(
  caption: string,
  hashtags: string[],
  mediaPath: string,
): Promise<InstagramPostResult> {
  const token = env.IG_ACCESS_TOKEN;
  const igUserId = env.IG_ACCOUNT_ID;
  const publicAppUrl = env.APP_PUBLIC_URL;

  if (!token || !igUserId) {
    throw new Error('IG_ACCESS_TOKEN veya IG_ACCOUNT_ID eksik');
  }
  if (!publicAppUrl) {
    throw new Error("APP_PUBLIC_URL eksik, görsel URL'si oluşturulamıyor");
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

    log.debug({ creationId }, 'Instagram media container oluşturuldu. Yayınlanıyor...');

    // Eğer video ise (Reels) container'ın işlenmesi biraz vakit alabilir. (Polling gerekebilir ama şimdilik bekleyelim)
    if (isVideo) {
      log.info('Video işlenmesi için 15 saniye bekleniyor...');
      await new Promise((resolve) => setTimeout(resolve, 15000));
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
