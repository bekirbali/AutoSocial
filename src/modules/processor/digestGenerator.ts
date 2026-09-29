import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { createLogger } from '../../lib/logger.js';
import { getRandomAudioTrack } from './reelGenerator.js';

const log = createLogger('processor:digestGenerator');

export interface DigestReelOptions {
  durationPerSlideSeconds?: number;
  slideDurations?: number[];           // Her slayt için özel konuşma süresi (TTS senkronu)
  transitionType?: 'smoothleft' | 'fade' | 'slideleft' | 'fadeblack' | 'none'; // Geçiş efekti (varsayılan: smoothleft)
  transitionDuration?: number;         // Geçiş süresi (varsayılan: 0.35s)
  audioPath?: string | null;           // Arka plan ritmik müzik yolu
  voiceoverAudioPath?: string | null;  // AI Türkçe seslendirmesi (ana ses)
  subtitlesPath?: string | null;       // Senkronize Karaoke altyazı dosyası (.ass veya .srt)
  subtitlesSrtPath?: string | null;    // Geriye dönük uyumluluk için .srt yolu
  totalDurationSeconds?: number;       // Seslendirme süresine tam eşitlenen süre
}

/**
 * Birden fazla 9:16 haber slayt kartından tek bir Instagram Reels videosu oluşturur.
 * AI Seslendirme (TTS), senkronize dinamik altyazı, yumuşak geçiş efektleri ve arka plan müziğini (ducking) FFmpeg ile sentezler.
 *
 * @param slideImages - 9:16 formatındaki görsel yolları dizisi
 * @param outputVideoPath - Hedef .mp4 dosya yolu
 * @param options - Slayt süreleri, geçiş tipi, TTS ses yolu, altyazı yolu ve müzik
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
  let totalDuration: number;
  let slideDurations: number[];

  if (options.slideDurations && options.slideDurations.length === slideImages.length) {
    slideDurations = options.slideDurations;
    totalDuration = Math.round(slideDurations.reduce((a, b) => a + b, 0) * 100) / 100;
  } else if (options.totalDurationSeconds && options.totalDurationSeconds > 0) {
    totalDuration = options.totalDurationSeconds;
    const dur = Math.round((totalDuration / slideImages.length) * 100) / 100;
    slideDurations = slideImages.map(() => dur);
  } else {
    const defaultDuration =
      slideImages.length === 1
        ? 7
        : slideImages.length === 2
        ? 6
        : slideImages.length >= 5
        ? 4.5
        : 5;
    const dur = options.durationPerSlideSeconds ?? defaultDuration;
    slideDurations = slideImages.map(() => dur);
    totalDuration = dur * slideImages.length;
  }

  const audioTrack = options.audioPath !== undefined ? options.audioPath : await getRandomAudioTrack();
  const voiceoverPath = options.voiceoverAudioPath && existsSync(options.voiceoverAudioPath)
    ? options.voiceoverAudioPath
    : null;
  const subPath = options.subtitlesPath && existsSync(options.subtitlesPath)
    ? options.subtitlesPath
    : options.subtitlesSrtPath && existsSync(options.subtitlesSrtPath)
    ? options.subtitlesSrtPath
    : null;

  const transType = options.transitionType ?? 'smoothleft';
  const useTransition = transType !== 'none' && slideImages.length > 1;
  const transDur = Math.min(options.transitionDuration ?? 0.35, 0.5);

  return new Promise((resolve, reject) => {
    const ffmpegArgs: string[] = ['-y'];

    // Her slaytı input olarak ekle.
    // Eğer xfade geçişi varsa, son slayt hariç transDur kadar uzatılır ki geçiş sırasında süre eksilmesin
    for (let i = 0; i < slideImages.length; i++) {
      const dur = useTransition && i < slideImages.length - 1
        ? (slideDurations[i] + transDur).toFixed(2)
        : slideDurations[i].toFixed(2);
      ffmpegArgs.push('-loop', '1', '-t', dur, '-i', slideImages[i]);
    }

    const videoInputCount = slideImages.length;
    let nextInputIndex = videoInputCount;

    // 1. Video Filtresi: Girişleri Normalize Et (PTS, FPS ve Timebase Senkronu)
    // Slayt döngülerinde (loop) zaman damgalarının kaymasını ve altyazı takılmasını önler
    let filterComplex = '';
    for (let i = 0; i < slideImages.length; i++) {
      filterComplex += `[${i}:v]fps=25,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[v_norm_${i}];`;
    }

    let videoOutLabel = 'v_norm_0';

    if (useTransition) {
      // Slayt geçişleri zinciri: offset tam olarak önceki slaytların süreleri toplamıdır
      let currentOffset = slideDurations[0];
      let filterChain = `[v_norm_0][v_norm_1]xfade=transition=${transType}:duration=${transDur}:offset=${currentOffset.toFixed(2)}[v_tr_1]`;
      let lastLabel = 'v_tr_1';

      for (let i = 2; i < slideImages.length; i++) {
        currentOffset += slideDurations[i - 1];
        const nextLabel = `v_tr_${i}`;
        filterChain += `;[${lastLabel}][v_norm_${i}]xfade=transition=${transType}:duration=${transDur}:offset=${currentOffset.toFixed(2)}[${nextLabel}]`;
        lastLabel = nextLabel;
      }
      filterComplex += filterChain;
      videoOutLabel = lastLabel;
    } else if (slideImages.length > 1) {
      const concatInputs = slideImages.map((_, idx) => `[v_norm_${idx}]`).join('');
      filterComplex += `${concatInputs}concat=n=${videoInputCount}:v=1:a=0[v_concat]`;
      videoOutLabel = 'v_concat';
    }

    // Altyazı Filtresi Öncesi Zaman Çizelgesini Sabitle
    filterComplex += `;[${videoOutLabel}]fps=25,settb=AVTB,setpts=PTS-STARTPTS[v_synced]`;

    // Altyazı Filtresi (Karaoke ASS veya SRT)
    if (subPath) {
      const escapedSub = path.resolve(subPath).replace(/\\/g, '/').replace(/:/g, '\\:');
      if (subPath.endsWith('.ass')) {
        // ASS Karaoke altyazı: ASS dosyasının kendi stili ve \kf karaoke boyaması doğrudan libass tarafından işlenir
        filterComplex += `;[v_synced]subtitles='${escapedSub}'[v]`;
      } else {
        // SRT fallback: force_style ile güvenli bölgeye hizala (MarginV=480, FontSize=62)
        filterComplex += `;[v_synced]subtitles='${escapedSub}':force_style='PlayResX=1080,PlayResY=1920,FontName=Segoe UI,FontSize=62,Bold=1,PrimaryColour=&H0000D7FF,OutlineColour=&H00000000,BorderStyle=1,Outline=5,Shadow=2,Alignment=2,MarginV=480'[v]`;
      }
    } else {
      filterComplex += `;[v_synced]null[v]`;
    }

    // 2. Ses Girişleri ve Miksajı (AI Seslendirme + Ducked Arka Plan Beat)
    let hasAudio = false;

    if (voiceoverPath && audioTrack && existsSync(audioTrack)) {
      hasAudio = true;
      const voiceIdx = nextInputIndex++;
      ffmpegArgs.push('-i', voiceoverPath);

      const beatIdx = nextInputIndex++;
      ffmpegArgs.push('-stream_loop', '-1', '-i', audioTrack);

      // Spiker sesi önde (volume=1.0), arka plan beat kısık (volume=0.14) ve sonda fade out
      filterComplex += `;[${voiceIdx}:a]volume=1.0[a_voice];[${beatIdx}:a]volume=0.14,afade=t=out:st=${Math.max(0, totalDuration - 1)}:d=1[a_beat];[a_voice][a_beat]amix=inputs=2:duration=first:dropout_transition=2[a]`;
    } else if (voiceoverPath) {
      hasAudio = true;
      const voiceIdx = nextInputIndex++;
      ffmpegArgs.push('-i', voiceoverPath);
      filterComplex += `;[${voiceIdx}:a]volume=1.0[a]`;
    } else if (audioTrack && existsSync(audioTrack)) {
      hasAudio = true;
      const beatIdx = nextInputIndex++;
      ffmpegArgs.push('-stream_loop', '-1', '-i', audioTrack);
      filterComplex += `;[${beatIdx}:a]afade=t=out:st=${Math.max(0, totalDuration - 1)}:d=1[a]`;
    }

    ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[v]');
    if (hasAudio) {
      ffmpegArgs.push('-map', '[a]');
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
        slideDurations,
        totalDuration,
        transition: transType,
        output: path.basename(outputVideoPath),
        hasVoiceover: !!voiceoverPath,
        hasSubtitles: !!subPath,
        hasBeat: !!audioTrack,
      },
      '🎬 TeknoFiltre Reels videosu sentezleniyor (FFmpeg + TTS + Altyazı + Geçiş)',
    );

    const proc = spawn('ffmpeg', ffmpegArgs);

    let stderrData = '';
    proc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log.info({ outputVideoPath, totalDuration }, '✅ Reels videosu başarıyla oluşturuldu');
        resolve(outputVideoPath);
      } else {
        log.error({ code, stderr: stderrData.slice(-500) }, 'FFmpeg render hatası');
        reject(new Error(`FFmpeg reels işlemi hata ile sonlandı (kod: ${code})`));
      }
    });

    proc.on('error', (err) => {
      log.error({ err: err.message }, 'FFmpeg başlatılamadı');
      reject(err);
    });
  });
}
