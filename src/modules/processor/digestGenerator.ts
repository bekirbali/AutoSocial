import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { createLogger } from '../../lib/logger.js';
import { getRandomAudioTrack } from './reelGenerator.js';

const log = createLogger('processor:digestGenerator');

export interface DigestReelOptions {
  durationPerSlideSeconds?: number;
  audioPath?: string | null;
}

/**
 * Birden fazla 9:16 haber slayt kartından tek bir Instagram Reels videosu oluşturur.
 * Okunabilirliği maksimize etmek için kartlar statik ve nettir; tempo müzik ve slayt geçişleriyle sağlanır.
 *
 * @param slideImages - 9:16 formatındaki görsel yolları dizisi
 * @param outputVideoPath - Hedef .mp4 dosya yolu
 * @param options - Slayt başına süre ve özel ses yolu
 */
export async function generateDigestReel(
  slideImages: string[],
  outputVideoPath: string,
  options: DigestReelOptions = {},
): Promise<string> {
  if (!slideImages || slideImages.length === 0) {
    throw new Error('Digest için en az bir slayt görseli gereklidir');
  }

  // Her slaytın varlığını doğrula
  for (const img of slideImages) {
    if (!existsSync(img)) {
      throw new Error(`Slayt görseli bulunamadı: ${img}`);
    }
  }

  // Slayt sayısı ve süre hesabı:
  // 1 slayt: 7s
  // 2 slayt: 6s (toplam 12s)
  // 3-4 slayt: 5s (toplam 15-20s)
  // 5 slayt: 4.5s (toplam 22.5s)
  const defaultDuration =
    slideImages.length === 1
      ? 7
      : slideImages.length === 2
      ? 6
      : slideImages.length >= 5
      ? 4.5
      : 5;

  const durationPerSlide = options.durationPerSlideSeconds ?? defaultDuration;
  const totalDuration = durationPerSlide * slideImages.length;
  const audioTrack = options.audioPath !== undefined ? options.audioPath : await getRandomAudioTrack();

  return new Promise((resolve, reject) => {
    const ffmpegArgs: string[] = ['-y'];

    // Her slaytı -loop 1 -t duration ile input olarak ekle
    for (const img of slideImages) {
      ffmpegArgs.push('-loop', '1', '-t', durationPerSlide.toString(), '-i', img);
    }

    const videoInputCount = slideImages.length;
    let filterComplex = '';

    // Concat filter: [0:v][1:v]...[N-1:v]concat=n=N:v=1:a=0[v]
    const concatInputs = slideImages.map((_, idx) => `[${idx}:v]`).join('');
    filterComplex += `${concatInputs}concat=n=${videoInputCount}:v=1:a=0[v]`;

    if (audioTrack && existsSync(audioTrack)) {
      const audioInputIndex = videoInputCount;
      ffmpegArgs.push('-stream_loop', '-1', '-i', audioTrack);
      filterComplex += `;[${audioInputIndex}:a]afade=t=out:st=${Math.max(0, totalDuration - 1)}:d=1[a]`;

      ffmpegArgs.push(
        '-filter_complex',
        filterComplex,
        '-map',
        '[v]',
        '-map',
        '[a]',
      );
    } else {
      ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[v]');
    }

    ffmpegArgs.push(
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'fast',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-t',
      totalDuration.toString(),
      outputVideoPath,
    );

    log.info(
      {
        slideCount: slideImages.length,
        durationPerSlide,
        totalDuration,
        output: path.basename(outputVideoPath),
        hasAudio: !!audioTrack,
      },
      '🎬 Toplu Bülten Reels videosu derleniyor (FFmpeg)',
    );

    const proc = spawn('ffmpeg', ffmpegArgs);

    let stderrData = '';
    proc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log.info({ outputVideoPath, totalDuration }, '✅ Bülten videosu başarıyla oluşturuldu');
        resolve(outputVideoPath);
      } else {
        log.error({ code, stderr: stderrData.slice(-500) }, 'FFmpeg bülten render hatası');
        reject(new Error(`FFmpeg bülten işlemi hata ile sonlandı (kod: ${code})`));
      }
    });

    proc.on('error', (err) => {
      log.error({ err: err.message }, 'FFmpeg başlatılamadı');
      reject(err);
    });
  });
}
