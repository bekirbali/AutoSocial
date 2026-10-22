import 'dotenv/config';
import { env } from '../src/config/env.js';
import { generateDigestSlideCard } from '../src/modules/processor/image.js';
import { generateReelsDigestScript } from '../src/modules/processor/ai.js';
import { generateDigestReel } from '../src/modules/processor/digestGenerator.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Gemini 2.5 Flash Audio API ile metni sese dönüştürür (WAV/MP3)
 */
async function generateGeminiSpeechSegment(text: string, voiceName: string = 'Aoede', outFilePrefix: string): Promise<{ audioPath: string; duration: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${env.GEMINI_API_KEY}`;
  
  // "POS" gibi kısaltmaların İngilizce harf harf (P-O-S -> peos) okunmasını engelle
  const cleanText = text
    .replace(/\bPOS\b/g, 'pos')
    .replace(/\bpos cihazı\b/gi, 'pos cihazı');

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Sen enerjik, samimi ve akıcı konuşan bir kadın teknoloji spikerisin. YouTube Shorts / Reels tarzında, arkadaşına heyecanlı bir haber anlatır gibi doğal Türkçe ile seslendir. Kısaltmaları İngilizce harf harf heceleme (örneğin 'pos' kelimesini doğrudan pos olarak oku), robotik olma:\n\n${cleanText}`
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName
          }
        }
      }
    }
  };

  const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
  const parts = res.data?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p: any) => p.inlineData);

  if (!audioPart) {
    throw new Error('Gemini ses verisi döndürmedi');
  }

  const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
  const tempDir = path.resolve('output', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const rawPcmPath = path.join(tempDir, `${outFilePrefix}.pcm`);
  const wavPath = path.join(tempDir, `${outFilePrefix}.wav`);
  fs.writeFileSync(rawPcmPath, pcmBuffer);

  // PCM (24kHz s16le mono) -> WAV (44.1kHz)
  execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${rawPcmPath}" -ar 44100 "${wavPath}"`, { stdio: 'ignore' });

  // Süreyi ffprobe ile kesin al
  const durOut = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`, { encoding: 'utf8' }).trim();
  const duration = parseFloat(durOut) || 5;

  return { audioPath: wavPath, duration: Math.round(duration * 100) / 100 };
}

async function runGeminiReelsTest() {
  console.log('🚀 Gemini 2.0 Flash Audio (Kadın Spiker: Aoede) ile Reels Testi Başlıyor...\n');

  const newsItems = [
    {
      id: 'gemini_test_1',
      title: 'Sony Patent Aldı: DualSense Kollar Temassız POS Cihazı Oluyor',
      sourceName: "Tom's Hardware",
      category: 'gaming' as const,
      publishedAt: new Date(),
      imageUrl: 'https://cdn.mos.cms.futurecdn.net/KkbpjHyeWvgDQw7MS2xvqj-1920-80.jpg',
      tweetText: 'Sony aldığı yeni patentle DualSense kollarını market ve oyun içi alışverişlerde temassız POS terminaline dönüştürüyor.',
    },
    {
      id: 'gemini_test_2',
      title: 'Logitech Blue Yeti Mikrofonunu Yapay Zeka ile Yeniledi',
      sourceName: "Tom's Hardware",
      category: 'peripherals' as const,
      publishedAt: new Date(),
      imageUrl: 'https://cdn.mos.cms.futurecdn.net/rzUXEmUpCTLBZQSwXwkxAA-1920-80.jpg',
      tweetText: 'Yapay zekalı gürültü engelleme ve stüdyo efektleriyle Blue Yeti yenilendi.',
    },
    {
      id: 'gemini_test_3',
      title: 'AMD Ryzen 9 9950X Tahtı Devraldı: Dünyanın En Hızlı İşlemcisi',
      sourceName: 'TechPowerUp',
      category: 'cpu' as const,
      publishedAt: new Date(),
      imageUrl: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=1600&q=85',
      tweetText: '16 çekirdekli Ryzen 9 9950X, tekli ve çoklu çekirdekte Intel amiral gemisini geride bıraktı.',
    },
  ];

  // 1. Slayt kartları
  console.log('1. Adım: Slayt kartları hazırlanıyor...');
  const slideCards: string[] = [];
  for (let i = 0; i < newsItems.length; i++) {
    const item = newsItems[i]!;
    const cardPath = await generateDigestSlideCard({
      title: item.title,
      sourceName: item.sourceName,
      category: item.category,
      publishedAt: item.publishedAt,
      articleId: item.id,
      imageUrl: item.imageUrl,
      slideIndex: i + 1,
      totalSlides: newsItems.length,
      digestType: 'evening',
    });
    slideCards.push(cardPath);
  }

  // 2. Metin
  console.log('2. Adım: Gemini AI ile Reels spiker metni hazırlanıyor...');
  const scriptResult = await generateReelsDigestScript(newsItems);
  console.log(`   Kanca: ${scriptResult.hookTitle}`);

  // 3. Gemini Audio ile her segmenti seslendir (Aoede - Kadın Spiker)
  console.log('3. Adım: Gemini 2.5 Flash Audio (Aoede) ile Türkçe kadın sesi üretiliyor...');
  const audioSegments: string[] = [];
  const slideDurations: number[] = [];

  for (let i = 0; i < scriptResult.segments.length; i++) {
    const seg = scriptResult.segments[i]!;
    const textToSpeak = i === scriptResult.segments.length - 1
      ? `${seg.script} ${scriptResult.outroScript}`
      : seg.script;

    console.log(`   🎙️ Segment ${i + 1}/${scriptResult.segments.length} seslendiriliyor: "${textToSpeak.slice(0, 45)}..."`);
    const { audioPath, duration } = await generateGeminiSpeechSegment(textToSpeak, 'Aoede', `gemini_female_seg_${i + 1}`);
    audioSegments.push(audioPath);
    slideDurations.push(duration);
    console.log(`      ✅ Süre: ${duration} saniye`);
  }

  // 4. Sesleri birleştir (Master Audio)
  const masterAudio = path.resolve('output', 'temp', 'gemini_female_master_voice.wav');
  const concatListPath = path.resolve('output', 'temp', 'concat_female_list.txt');
  fs.writeFileSync(concatListPath, audioSegments.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${masterAudio}"`, { stdio: 'ignore' });

  console.log(`   🎵 Master ses birleştirildi. Toplam süre: ${slideDurations.reduce((a, b) => a + b, 0)} sn`);

  // 5. Video Sentezi
  console.log('4. Adım: FFmpeg ile Video + Kadın Sesi birleştiriliyor...');
  const outVideoDir = path.resolve('output', 'videos');
  if (!fs.existsSync(outVideoDir)) fs.mkdirSync(outVideoDir, { recursive: true });
  const outVideo = path.join(outVideoDir, 'test_reels_gemini_female.mp4');

  await generateDigestReel(slideCards, outVideo, {
    voiceoverAudioPath: masterAudio,
    slideDurations: slideDurations,
    transitionType: 'smoothleft',
    transitionDuration: 0.35,
  });

  console.log('\n🎉 TEST TAMAMLANDI!');
  console.log(`📁 Video Dosyası: ${outVideo}`);
  console.log(`📊 Video Boyutu: ${(fs.statSync(outVideo).size / 1024 / 1024).toFixed(2)} MB`);
}

runGeminiReelsTest().catch(console.error);
