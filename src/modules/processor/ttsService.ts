import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createLogger } from '../../lib/logger.js';
import { preparePhoneticScript, restoreDisplayWord } from './pronunciation.js';

const log = createLogger('processor:tts');

export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface WordBoundaryInfo {
  text: string;
  startMs: number;
  durationMs: number;
  endMs: number;
}

export interface TTSResult {
  audioPath: string;
  srtPath: string;
  assPath: string;
  durationSeconds: number;
  cues: SubtitleCue[];
  words: WordBoundaryInfo[];
}

export interface SegmentedTTSItem {
  text: string;
  articleIndex?: number;
}

export interface SegmentedTTSResult {
  masterAudioPath: string;
  masterAssPath: string;
  masterSrtPath: string;
  slideDurations: number[];
  totalDurationSeconds: number;
  allWords: WordBoundaryInfo[];
  allCues: SubtitleCue[];
}

export interface TTSOptions {
  voice?: 'tr-TR-AhmetNeural' | 'tr-TR-EmelNeural';
  outputDir?: string;
  baseFileName?: string;
  wordsPerCue?: number; // Ekranda aynı anda gösterilecek kelime sayısı (varsayılan: 3-4)
}

/**
 * Millisaniyeyi SRT zaman damgası formatına çevirir (00:00:01,234)
 */
function msToSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Millisaniyeyi ASS zaman damgası formatına çevirir (0:00:01.23)
 */
function msToAssTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/**
 * ffprobe ile ses dosyasının tam süresini (kuyruk sessizliği dahil) kesin okur
 */
function getExactAudioDuration(filePath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' },
    ).trim();
    const dur = parseFloat(out);
    if (!isNaN(dur) && dur > 0) {
      return Math.round(dur * 100) / 100;
    }
  } catch (err: any) {
    log.warn({ err: err.message, filePath }, 'ffprobe ile ses süresi okunamadı');
  }
  return 0;
}

/**
 * Kelime zaman damgalarından modern Instagram/TikTok tarzı Karaoke ASS altyazısı üretir.
 * Her sözcük spiker söylediği an beyazdan parlak altın sarısına pürüzsüz boyanır.
 */
export function buildKaraokeAss(words: WordBoundaryInfo[]): string {
  if (!words || words.length === 0) return '';

  const maxWordsPerPhrase = 4;
  const maxCharsPerPhrase = 26;
  const phrases: WordBoundaryInfo[][] = [];
  let currentPhrase: WordBoundaryInfo[] = [];
  let currentChars = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wouldExceedWords = currentPhrase.length >= maxWordsPerPhrase;
    const wouldExceedChars = currentChars + w.text.length + 1 > maxCharsPerPhrase;
    const isPunctuation = /[.!?:]$/.test(currentPhrase[currentPhrase.length - 1]?.text || '');

    if (currentPhrase.length > 0 && (wouldExceedWords || wouldExceedChars || isPunctuation)) {
      phrases.push(currentPhrase);
      currentPhrase = [w];
      currentChars = w.text.length;
    } else {
      currentPhrase.push(w);
      currentChars += w.text.length + 1;
    }
  }
  if (currentPhrase.length > 0) phrases.push(currentPhrase);

  const dialogues: string[] = [];

  for (let pIdx = 0; pIdx < phrases.length; pIdx++) {
    const phrase = phrases[pIdx];
    const firstWord = phrase[0];
    const lastWord = phrase[phrase.length - 1];

    const nextPhraseFirst = phrases[pIdx + 1]?.[0];
    const endMs = nextPhraseFirst
      ? Math.min(lastWord.endMs + 180, nextPhraseFirst.startMs)
      : lastWord.endMs + 250;

    let phraseText = '';
    for (let wIdx = 0; wIdx < phrase.length; wIdx++) {
      const w = phrase[wIdx];
      const nextW = phrase[wIdx + 1];
      const durMs = nextW ? nextW.startMs - w.startMs : w.endMs - w.startMs;
      const cs = Math.max(1, Math.round(durMs / 10));
      phraseText += `{\\kf${cs}}${w.text} `;
    }

    const startAss = msToAssTime(firstWord.startMs);
    const endAss = msToAssTime(endMs);

    dialogues.push(`Dialogue: 0,${startAss},${endAss},Karaoke,,0,0,0,,${phraseText.trim()}`);
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Segoe UI,62,&H0000D7FF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5.0,2,2,60,60,480,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogues.join('\n')}
`;
}

/**
 * Microsoft Edge Neural TTS ile doğal Türkçe seslendirme yapar ve senkronize .srt altyazı üretir.
 */
export async function generateVoiceoverWithSubtitles(
  scriptText: string,
  options: TTSOptions = {},
): Promise<TTSResult> {
  const voice = options.voice || 'tr-TR-AhmetNeural';
  const outputDir = options.outputDir || path.join(process.cwd(), 'output', 'audio');
  const baseName = options.baseFileName || `reels_voice_${Date.now()}`;
  const wordsPerCue = options.wordsPerCue || 3;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Temiz metin: Altyazı ve okuma için fazla sembolleri arındır
  const cleanScript = scriptText
    .replace(/[#*`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Yabancı terimleri Türkçe fonetik sözlüğe göre uyarla (Altyazıda orijinal kelimeler korunur)
  const { spokenText, originalTokens } = preparePhoneticScript(cleanScript);

  log.info(
    { voice, textLength: cleanScript.length, spokenLength: spokenText.length },
    '🎙️ Türkçe AI seslendirme başlatılıyor (Fonetik telaffuz aktif)',
  );

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    sentenceBoundaryEnabled: true,
    wordBoundaryEnabled: true,
  });

  // Geçici dizine üret
  const tempGenDir = path.join(outputDir, `tmp_${Date.now()}`);
  fs.mkdirSync(tempGenDir, { recursive: true });

  const genResult = await tts.toFile(tempGenDir, spokenText);
  tts.close();

  const finalAudioPath = path.join(outputDir, `${baseName}.mp3`);
  const finalSrtPath = path.join(outputDir, `${baseName}.srt`);

  // Sesi taşı
  fs.copyFileSync(genResult.audioFilePath, finalAudioPath);

  // Dosyanın ffprobe ile kesin uzunluğunu ölç (kuyruk sessizliği ve padding dahil)
  const exactDuration = getExactAudioDuration(finalAudioPath);

  // Metadata dosyasını oku ve kelime bazlı altyazı parçaları oluştur
  const words: WordBoundaryInfo[] = [];
  const cues: SubtitleCue[] = [];
  let totalDurationMs = 0;

  if (genResult.metadataFilePath && fs.existsSync(genResult.metadataFilePath)) {
    try {
      const metaRaw = fs.readFileSync(genResult.metadataFilePath, 'utf8');
      const metaJson = JSON.parse(metaRaw);
      const metadata = metaJson.Metadata || [];
      const totalWordBoundaries = metadata.filter((m: any) => m.Type === 'WordBoundary').length;

      let wordIdx = 0;
      for (const item of metadata) {
        if (item.Type === 'WordBoundary' && item.Data?.text?.Text) {
          const startMs = Math.round(item.Data.Offset / 10000);
          const durationMs = Math.round(item.Data.Duration / 10000);
          const endMs = startMs + durationMs;

          const rawTtsWord = item.Data.text.Text.trim();
          // Orijinal kelime eşleşmesini al ve altyazıda orijinal halini koru
          const origFallback = originalTokens.length === totalWordBoundaries
            ? originalTokens[wordIdx]
            : undefined;
          const displayWord = restoreDisplayWord(rawTtsWord, origFallback);
          wordIdx++;

          words.push({
            text: displayWord,
            startMs,
            durationMs,
            endMs,
          });

          if (endMs > totalDurationMs) {
            totalDurationMs = endMs;
          }
        }
      }

      // Kelimeleri gruplar halinde altyazı kurgusuna dönüştür
      let cueIndex = 1;
      for (let i = 0; i < words.length; i += wordsPerCue) {
        const slice = words.slice(i, i + wordsPerCue);
        if (slice.length === 0) continue;

        const cueText = slice.map((w) => w.text).join(' ');
        const startMs = slice[0].startMs;
        const endMs = slice[slice.length - 1].endMs;

        cues.push({
          index: cueIndex++,
          startMs,
          endMs,
          text: cueText,
        });
      }
    } catch (parseErr: any) {
      log.warn({ err: parseErr.message }, 'Metadata parse hatası, temel altyazıya dönülüyor');
    }
  }

  // Fallback: Eğer metadata boşsa
  if (cues.length === 0) {
    const estimatedDurationMs = exactDuration > 0
      ? Math.round(exactDuration * 1000)
      : Math.max(5000, cleanScript.split(' ').length * 350);
    totalDurationMs = estimatedDurationMs;
    cues.push({
      index: 1,
      startMs: 0,
      endMs: estimatedDurationMs,
      text: cleanScript,
    });
  }

  // SRT dosyasını oluştur
  const srtContent = cues
    .map((cue) => {
      const startTime = msToSrtTime(cue.startMs);
      const endTime = msToSrtTime(cue.endMs);
      return `${cue.index}\n${startTime} --> ${endTime}\n${cue.text}\n`;
    })
    .join('\n');
  fs.writeFileSync(finalSrtPath, srtContent, 'utf8');

  // Karaoke ASS dosyasını oluştur
  const finalAssPath = path.join(outputDir, `${baseName}.ass`);
  const assContent = buildKaraokeAss(words);
  fs.writeFileSync(finalAssPath, assContent, 'utf8');

  // Geçici dizini temizle
  try {
    fs.rmSync(tempGenDir, { recursive: true, force: true });
  } catch {}

  const durationSeconds = exactDuration > 0
    ? exactDuration
    : Math.round((totalDurationMs / 1000) * 10) / 10;

  log.info(
    {
      audioPath: path.basename(finalAudioPath),
      srtPath: path.basename(finalSrtPath),
      assPath: path.basename(finalAssPath),
      durationSeconds,
      wordCount: words.length,
    },
    '✅ TTS ve Karaoke altyazı başarıyla üretildi',
  );

  return {
    audioPath: finalAudioPath,
    srtPath: finalSrtPath,
    assPath: finalAssPath,
    durationSeconds,
    cues,
    words,
  };
}

/**
 * Birden fazla haber segmenti için ayrı ayrı TTS üretir, her slaytın konuşma süresini kesin ölçer,
 * sesleri FFmpeg concat ile birleştirir ve zaman damgası kaydırılmış master Karaoke ASS dosyasını oluşturur.
 *
 * Bu sayede video slaytı değiştiği an spiker de yeni habere geçer ve kelime kelime karaoke boyama çalışır.
 */
export async function generateSegmentedVoiceoverWithSubtitles(
  segments: SegmentedTTSItem[],
  options: TTSOptions = {},
): Promise<SegmentedTTSResult> {
  if (!segments || segments.length === 0) {
    throw new Error('Seslendirme için en az bir segment gereklidir');
  }

  const outputDir = options.outputDir || path.join(process.cwd(), 'output', 'audio');
  const baseName = options.baseFileName || `reels_segmented_${Date.now()}`;
  const wordsPerCue = options.wordsPerCue || 3;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const slideDurations: number[] = [];
  const allWords: WordBoundaryInfo[] = [];
  const allCues: SubtitleCue[] = [];
  const audioFiles: string[] = [];
  let currentOffsetMs = 0;
  let cueIdx = 1;

  log.info({ segmentCount: segments.length }, '🎙️ Segment bazlı senkronize seslendirme başlatılıyor');

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segBaseName = `${baseName}_part_${i + 1}`;

    const ttsRes = await generateVoiceoverWithSubtitles(seg.text, {
      ...options,
      outputDir,
      baseFileName: segBaseName,
      wordsPerCue,
    });

    slideDurations.push(ttsRes.durationSeconds);
    audioFiles.push(ttsRes.audioPath);

    // Kelimeleri kümülatif süre kadar ötele (Karaoke ASS için)
    for (const w of ttsRes.words) {
      allWords.push({
        text: w.text,
        startMs: w.startMs + currentOffsetMs,
        durationMs: w.durationMs,
        endMs: w.endMs + currentOffsetMs,
      });
    }

    // Altyazı zaman damgalarını kümülatif süre kadar ötele (SRT fallback için)
    for (const cue of ttsRes.cues) {
      allCues.push({
        index: cueIdx++,
        startMs: cue.startMs + currentOffsetMs,
        endMs: cue.endMs + currentOffsetMs,
        text: cue.text,
      });
    }

    // Offset bir sonraki sesin başladığı kesin milisaniyedir
    currentOffsetMs += Math.round(ttsRes.durationSeconds * 1000);
  }

  // 1. FFmpeg concat demuxer ile sesleri kayıpsız ve pürüzsüz birleştir
  const listFilePath = path.join(outputDir, `${baseName}_concat.txt`);
  const fileLines = audioFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listFilePath, fileLines, 'utf8');

  const masterAudioPath = path.join(outputDir, `${baseName}_master.mp3`);
  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${masterAudioPath}"`, {
      stdio: 'pipe',
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'Master ses birleştirme başarısız');
    throw new Error(`Master ses birleştirilemedi: ${err.message}`);
  } finally {
    try {
      fs.unlinkSync(listFilePath);
    } catch {}
  }

  // Birleştirilmiş master ses dosyasının kesin süresini ölç
  const exactMasterDuration = getExactAudioDuration(masterAudioPath);
  const totalDurationSeconds = exactMasterDuration > 0
    ? exactMasterDuration
    : Math.round((currentOffsetMs / 1000) * 100) / 100;

  // 2. Birleştirilmiş master Karaoke .ass dosyasını yaz
  const masterAssPath = path.join(outputDir, `${baseName}_master.ass`);
  const masterAssContent = buildKaraokeAss(allWords);
  fs.writeFileSync(masterAssPath, masterAssContent, 'utf8');

  // 3. Birleştirilmiş master .srt altyazı dosyasını yaz (fallback)
  const masterSrtPath = path.join(outputDir, `${baseName}_master.srt`);
  const srtContent = allCues
    .map((c) => {
      const startTime = msToSrtTime(c.startMs);
      const endTime = msToSrtTime(c.endMs);
      return `${c.index}\n${startTime} --> ${endTime}\n${c.text}\n`;
    })
    .join('\n');
  fs.writeFileSync(masterSrtPath, srtContent, 'utf8');

  log.info(
    {
      slideDurations,
      totalDurationSeconds,
      masterAudio: path.basename(masterAudioPath),
      masterAss: path.basename(masterAssPath),
      masterSrt: path.basename(masterSrtPath),
      totalWords: allWords.length,
    },
    '🎬 Segment bazlı seslendirme ve Karaoke ASS altyazısı tamamlandı',
  );

  return {
    masterAudioPath,
    masterAssPath,
    masterSrtPath,
    slideDurations,
    totalDurationSeconds,
    allWords,
    allCues,
  };
}

