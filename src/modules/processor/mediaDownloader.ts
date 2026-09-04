import youtubedl from 'youtube-dl-exec';
import { createLogger } from '../../lib/logger.js';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const log = createLogger('processor:mediaDownloader');

/**
 * Verilen URL'deki videoyu indirir.
 * @param url Video içeren (Twitter, Reddit, YouTube, Instagram vb.) link
 * @returns İndirilen videonun mutlak yolu (absolute path)
 */
export async function downloadVideo(url: string): Promise<string> {
  const outputDir = path.join(process.cwd(), 'output', 'videos');
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `${randomUUID()}.mp4`;
  const outputPath = path.join(outputDir, fileName);

  log.info({ url }, 'Video indirme başlatıldı (yt-dlp)');

  try {
    await youtubedl(url, {
      output: outputPath,
      // mp4 formatını tercih et (IG ve Twitter mp4 sever)
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      maxFilesize: '50M', // 50MB üst limit (İşlem/yükleme süresini korumak için)
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    });

    log.info({ outputPath }, '✅ Video başarıyla indirildi');
    return outputPath;
  } catch (error: any) {
    log.error({ err: error.message, url }, '❌ Video indirilemedi');
    throw new Error(`Video indirme başarısız: ${error.message}`);
  }
}
