import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('processor:reelGenerator');

const AUDIO_DIR = path.join(process.cwd(), 'assets', 'audio');

/**
 * assets/audio dizininden rastgele bir telifsiz ses parçası seçer
 */
export async function getRandomAudioTrack(): Promise<string | null> {
  if (!existsSync(AUDIO_DIR)) {
    log.warn({ AUDIO_DIR }, 'Ses dizini bulunamadı');
    return null;
  }

  try {
    const files = await readdir(AUDIO_DIR);
    const audioFiles = files.filter((f) =>
      /\.(ogg|mp3|wav|m4a|aac)$/i.test(f)
    );

    if (audioFiles.length === 0) {
      log.warn('Ses dizininde ses dosyası bulunamadı');
      return null;
    }

    const randomIndex = Math.floor(Math.random() * audioFiles.length);
    const chosenFile = path.join(AUDIO_DIR, audioFiles[randomIndex]!);
    log.debug({ chosenFile: path.basename(chosenFile) }, 'Reels için ses parçası seçildi');
    return chosenFile;
  } catch (err: any) {
    log.error({ err: err.message }, 'Ses parçası seçilirken hata oluştu');
    return null;
  }
}

export interface ReelOptions {
  durationSeconds?: number;
  audioPath?: string | null;
}

/**
 * 9:16 boyutundaki görselden ve telifsiz arka plan müziğinden
 * FFmpeg ile Ken Burns animasyonlu 5-7 saniyelik bir MP4 Reels videosu üretir.
 *
 * @param imagePath - 9:16 formatındaki giriş görseli (JPEG/PNG)
 * @param outputVideoPath - Hedef .mp4 dosya yolu
 * @param options - Video ayarları (süre, özel ses vb.)
 */
export async function generateReelVideo(
  imagePath: string,
  outputVideoPath: string,
  options: ReelOptions = {},
): Promise<string> {
  const duration = options.durationSeconds ?? 6;
  const fps = 30;
  const totalFrames = duration * fps;

  if (!existsSync(imagePath)) {
    throw new Error(`Giriş görseli bulunamadı: ${imagePath}`);
  }

  const audioTrack = options.audioPath !== undefined ? options.audioPath : await getRandomAudioTrack();

  return new Promise((resolve, reject) => {
    // Filtre: Zarif Ken Burns (hafif %2.5 zoom in) + Ses fade-out
    const zoomFilter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.00025,1.025)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=${fps}[v]`;
    
    const ffmpegArgs: string[] = ['-y', '-loop', '1', '-i', imagePath];

    if (audioTrack && existsSync(audioTrack)) {
      ffmpegArgs.push('-stream_loop', '-1', '-i', audioTrack);
      const filterComplex = `[0:v]${zoomFilter};[1:a]afade=t=out:st=${Math.max(0, duration - 1)}:d=1[a]`;
      ffmpegArgs.push(
        '-filter_complex',
        filterComplex,
        '-map',
        '[v]',
        '-map',
        '[a]',
      );
    } else {
      // Ses yoksa sadece video
      ffmpegArgs.push('-vf', zoomFilter);
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
      duration.toString(),
      outputVideoPath,
    );

    log.info(
      { imagePath: path.basename(imagePath), output: path.basename(outputVideoPath), duration, hasAudio: !!audioTrack },
      '🎬 Reels videosu render ediliyor (FFmpeg)',
    );

    const proc = spawn('ffmpeg', ffmpegArgs);

    let stderrData = '';
    proc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log.info({ outputVideoPath }, '✅ Reels videosu başarıyla oluşturuldu');
        resolve(outputVideoPath);
      } else {
        log.error({ code, stderr: stderrData.slice(-500) }, 'FFmpeg render hatası');
        reject(new Error(`FFmpeg işlemi hata ile sonlandı (kod: ${code})`));
      }
    });

    proc.on('error', (err) => {
      log.error({ err: err.message }, 'FFmpeg başlatılamadı');
      reject(err);
    });
  });
}
