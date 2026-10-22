import 'dotenv/config';
import { env } from '../src/config/env.js';
import { generateDigestSlideCard } from '../src/modules/processor/image.js';
import { generateSegmentedVoiceoverWithSubtitles } from '../src/modules/processor/ttsService.js';
import { generateDigestReel } from '../src/modules/processor/digestGenerator.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Metni verilen satır genişliğine göre böler
 */
function wrapText(text: string, maxCharsPerLine: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 9:16 Formatında (1080x1920) Profesyonel Kanca / Kapak Kartı Üretir
 */
async function generateHookCoverCard(hookTitle: string): Promise<string> {
  const width = 1080;
  const height = 1920;
  const outDir = path.resolve('output', 'images');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'reels_cover_hook.jpeg');

  const cleanTitle = hookTitle.replace(/[!?.]$/, '').toUpperCase();
  const rawLines = wrapText(cleanTitle, 16).split('\n').slice(0, 4);
  const fontSize = rawLines.length >= 3 ? 72 : 84;
  const lineHeight = rawLines.length >= 3 ? 92 : 108;
  const totalTextHeight = rawLines.length * lineHeight;
  const startY = Math.round((height - totalTextHeight) / 2) + 20;

  const linesSvg = rawLines
    .map((line, i) => {
      // Son satırı parlak neon sarı/amber yap, diğerleri saf beyaz
      const fill = i === rawLines.length - 1 ? '#facc15' : '#ffffff';
      return `<text x="540" y="${startY + i * lineHeight}" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="900" fill="${fill}" letter-spacing="-1" filter="url(#glow)">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#090d16;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#111827;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#030712;stop-opacity:1" />
    </linearGradient>

    <!-- Parıltı Efekti -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000000" flood-opacity="0.9"/>
    </filter>

    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.22" />
      <stop offset="60%" style="stop-color:#1d4ed8;stop-opacity:0.08" />
      <stop offset="100%" style="stop-color:#000000;stop-opacity:0" />
    </radialGradient>
  </defs>

  <!-- Arka Plan -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  <circle cx="540" cy="960" r="500" fill="url(#centerGlow)" />

  <!-- Izgara (Grid) Çizgileri -->
  <line x1="120" y1="0" x2="120" y2="${height}" stroke="white" stroke-opacity="0.03" stroke-width="2" />
  <line x1="${width - 120}" y1="0" x2="${width - 120}" y2="${height}" stroke="white" stroke-opacity="0.03" stroke-width="2" />
  <line x1="0" y1="400" x2="${width}" y2="400" stroke="white" stroke-opacity="0.03" stroke-width="2" />
  <line x1="0" y1="${height - 400}" x2="${width}" y2="${height - 400}" stroke="white" stroke-opacity="0.03" stroke-width="2" />

  <!-- Üst Marka Alanı -->
  <g transform="translate(540, 240)">
    <!-- Hap Rozet -->
    <rect x="-130" y="-24" width="260" height="48" rx="24" fill="#2563eb" fill-opacity="0.3" stroke="#3b82f6" stroke-width="2" />
    <text x="0" y="8" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#93c5fd" letter-spacing="2">GÜNÜN ÖZETİ</text>
    
    <text x="0" y="70" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="900" fill="#ffffff" letter-spacing="3">TEKNOFİLTRE</text>
  </g>

  <!-- Kanca Vurgu Çizgisi -->
  <rect x="440" y="${startY - 60}" width="200" height="6" rx="3" fill="#facc15" />

  <!-- Kanca Başlığı -->
  ${linesSvg}

  <!-- Alt Yönlendirme (Swipe Up / İzle) -->
  <g transform="translate(540, 1680)">
    <circle cx="0" cy="0" r="28" fill="white" fill-opacity="0.1" />
    <path d="M-8,-4 L0,4 L8,-4" fill="none" stroke="#facc15" stroke-width="3" stroke-linecap="round" />
    <text x="0" y="55" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#94a3b8" letter-spacing="1">İZLEMEYE DEVAM ET</text>
  </g>
</svg>`;

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 92 })
    .toFile(outPath);

  return outPath;
}

async function generateScriptWith35Lite(articles: any[]) {
  const articlesListText = articles
    .map((a, i) => `${i + 1}. [Haber ${i + 1}] ${a.title}${a.tweetText ? ` (Özet: ${a.tweetText})` : ''}`)
    .join('\n');

  const prompt = `Sen "TeknoFiltre" markasının Instagram Reels spikerisin.
GÖREV: Aşağıdaki ${articles.length} haber için ultra dinamik, akışı durduran bir Türkçe Reels seslendirme metni hazırla.
VİDEO YAPISI:
- 0. Slayt: Sadece ve sadece merak uyandıran KANCA (hookTitle) seslendirilecek.
- 1, 2, 3. Slaytlar: Sırasıyla 3 haber hap bilgi olarak aktarılacak.

HABER LİSTESİ:
${articlesListText}

ALTIN KURALLAR:
1. KANCA BAŞLIĞI (hookTitle): Videonun kapak slaytında spikerin söyleyeceği 3-5 kelimelik, akışı durduran şok bir kanca (Örn: "Günün En Bomba 3 Teknolojisi!", "Konsol Dünyasında Büyük Devrim!").
2. SAF HAP BİLGİ: Her haber segmenti KESİNLİKLE tek bir vurucu cümle ve MAKSİMUM 10-14 KELİME olmalıdır.
3. SELAMLAŞMA YASAKTIR: "Merhaba", "Selamlar" gibi girişler kesinlikle yasaktır.
4. KISALTMALAR: POS gibi kısaltmaları pos cihazı olarak yaz.
5. OUTRO: "Detaylar açıklamada. Teknoloji haberleri için TeknoFiltre'yi takip etmeyi unutmayın."

ÇIKTI JSON FORMATI (SADECE JSON DÖNDÜR):
{
  "hookTitle": "3-5 kelimelik şok kanca başlığı",
  "segments": [
    {
      "articleIndex": 1,
      "headline": "1. haber başlığı",
      "script": "Maksimum 10-14 kelimelik tek cümlelik hap bilgi."
    }
  ],
  "outroScript": "Detaylar açıklamada. Teknoloji haberleri için TeknoFiltre'yi takip etmeyi unutmayın."
}`;

  console.log('🤖 Gemini 3.5 Flash Lite ile Kancalı Senaryo Üretiliyor...');
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    }
  );

  const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(rawText);
}

async function runTestWithVisualHookCover() {
  console.log('--- TEST: Görsel Kapak Slaytlı Reels (1 Kapak + 3 Haber Slaytı) ---\n');

  const newsItems = [
    {
      id: 'news_1_dualsense',
      title: 'Sony Patent Aldı: DualSense Kollar Temassız POS Cihazı Oluyor',
      sourceName: "Tom's Hardware",
      category: 'gaming' as const,
      publishedAt: new Date(),
      imageUrl: 'https://cdn.mos.cms.futurecdn.net/KkbpjHyeWvgDQw7MS2xvqj-1920-80.jpg',
      tweetText: 'Sony aldığı yeni patentle DualSense kollarını market ve oyun içi alışverişlerde temassız pos cihazına dönüştürüyor.',
    },
    {
      id: 'news_2_yeti',
      title: 'Logitech Blue Yeti Mikrofonunu Yapay Zeka ile Yeniledi',
      sourceName: "Tom's Hardware",
      category: 'peripherals' as const,
      publishedAt: new Date(),
      imageUrl: 'https://cdn.mos.cms.futurecdn.net/rzUXEmUpCTLBZQSwXwkxAA-1920-80.jpg',
      tweetText: 'Yapay zekalı gürültü engelleme ve yeni stüdyo efektleriyle Blue Yeti efsanesi yenilendi.',
    },
    {
      id: 'news_3_ryzen',
      title: 'AMD Ryzen 9 9950X Tahtı Devraldı: Dünyanın En Hızlı İşlemcisi',
      sourceName: 'TechPowerUp',
      category: 'cpu' as const,
      publishedAt: new Date(),
      imageUrl: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=1600&q=85',
      tweetText: '16 çekirdekli Ryzen 9 9950X, tekli ve çoklu çekirdekte Intel amiral gemisini açık ara geride bıraktı.',
    },
  ];

  // 1. Senaryo Üretimi
  console.log('1. Adım: Gemini 3.5 Flash Lite ile Kancalı Senaryo Üretiliyor...');
  const scriptResult = await generateScriptWith35Lite(newsItems);
  console.log(`   🔥 Kapak Kancası: "${scriptResult.hookTitle}"`);

  // 2. Görselleri Hazırla (0. Slayt = Özel Kapak Kartı, 1-3. Slaytlar = Haber Kartları)
  console.log('\n2. Adım: Slayt görselleri hazırlanıyor (0. Kapak + 3 Haber)...');
  const slideCards: string[] = [];

  // 0. Slayt: Özel Kanca Kapak Kartı
  const coverCardPath = await generateHookCoverCard(scriptResult.hookTitle);
  console.log(`   ✅ [0. Slayt - Kapak]: ${path.basename(coverCardPath)}`);
  slideCards.push(coverCardPath);

  // 1-3. Slaytlar: Haber Kartları
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
    console.log(`   ✅ [${i + 1}. Slayt - Haber]: ${path.basename(cardPath)}`);
    slideCards.push(cardPath);
  }

  // 3. Segment Bazlı Seslendirme (0. Kapak için Kanca Metni, 1-3 için Haberler)
  console.log('\n3. Adım: 4 Slayt İçin Microsoft Edge TTS (Ahmet) ile Seslendirme Yapılıyor...');
  const ttsSegments = [
    // 0. Slayt Sesi: Sadece Kapak Kancası!
    {
      articleIndex: 0,
      text: `${scriptResult.hookTitle}!`,
    },
    // 1-3. Slayt Sesleri: Haberler
    ...scriptResult.segments.map((seg: any, idx: number) => ({
      articleIndex: seg.articleIndex || idx + 1,
      text:
        idx === scriptResult.segments.length - 1
          ? `${seg.script} ${scriptResult.outroScript}`
          : seg.script,
    })),
  ];

  ttsSegments.forEach((seg, i) => {
    console.log(`   🎙️ Slayt ${i} Metni: "${seg.text}"`);
  });

  const ttsResult = await generateSegmentedVoiceoverWithSubtitles(ttsSegments, {
    voice: 'tr-TR-AhmetNeural',
    baseFileName: 'reels_cover_ahmet',
    wordsPerCue: 3,
  });

  console.log(`\n   ✅ Seslendirme tamamlandı. Toplam süre: ${ttsResult.totalDurationSeconds} sn`);
  console.log(`   ⏱️ Slayt Süreleri: [${ttsResult.slideDurations.map((d, i) => `Slayt ${i}: ${d}s`).join(', ')}]`);

  // 4. FFmpeg Video Montajı (4 Slayt + Smoothleft Geçişler)
  console.log('\n4. Adım: FFmpeg ile 4 Slayt + Geçişler + Ses + Karaoke Altyazı Sentezleniyor...');
  const outVideoDir = path.resolve('output', 'videos');
  if (!fs.existsSync(outVideoDir)) fs.mkdirSync(outVideoDir, { recursive: true });
  const outVideo = path.join(outVideoDir, 'test_reels_gorsel_kapakli_ahmet.mp4');

  await generateDigestReel(slideCards, outVideo, {
    voiceoverAudioPath: ttsResult.masterAudioPath,
    subtitlesPath: ttsResult.masterAssPath,
    slideDurations: ttsResult.slideDurations,
    transitionType: 'smoothleft',
    transitionDuration: 0.35,
  });

  console.log('\n🎉 GÖRSEL KAPAKLI REELS VİDEOSU BAŞARIYLA OLUŞTURULDU!');
  console.log(`📁 Video: ${outVideo}`);
  console.log(`📊 Boyut: ${(fs.statSync(outVideo).size / 1024 / 1024).toFixed(2)} MB`);
}

runTestWithVisualHookCover().catch(console.error);
