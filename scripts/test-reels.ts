import 'dotenv/config';
import { generateDigestSlideCard } from '../src/modules/processor/image.js';
import { generateSegmentedVoiceoverWithSubtitles } from '../src/modules/processor/ttsService.js';
import { generateReelsDigestScript } from '../src/modules/processor/ai.js';
import { generateDigestReel } from '../src/modules/processor/digestGenerator.js';
import path from 'path';
import fs from 'fs';

async function testReelsPipeline() {
  console.log('--- TEST: TeknoFiltre Senkronize Reels Pipeline (3/3 Haber Kapsamı + Segment TTS + xfade) ---\n');

  // 1. Üç adet güncel, gerçek yüksek çözünürlüklü haber verisi
  const newsItems = [
    {
      id: 'reels_news_1',
      title: 'Sony Patent Aldı: PlayStation Kolları Temassız Ödeme Cihazı Oluyor',
      sourceName: "Tom's Hardware",
      category: 'gaming' as const,
      publishedAt: new Date(),
      imageUrl: 'https://cdn.mos.cms.futurecdn.net/KkbpjHyeWvgDQw7MS2xvqj-1920-80.jpg',
      tweetText: 'Sony aldığı yeni patentle DualSense kollarını market ve oyun içi alışverişlerde temassız POS terminaline dönüştürüyor.',
    },
    {
      id: 'reels_news_2',
      title: 'Logitech Efsanevi Blue Yeti Mikrofonunu Yapay Zeka ile Yeniledi',
      sourceName: "Tom's Hardware",
      category: 'peripherals' as const,
      publishedAt: new Date(),
      imageUrl: 'https://cdn.mos.cms.futurecdn.net/rzUXEmUpCTLBZQSwXwkxAA-1920-80.jpg',
      tweetText: 'Yapay zekalı gürültü engelleme, 24-bit 96kHz ses ve yeni stüdyo efektleriyle Blue Yeti yenilendi.',
    },
    {
      id: 'reels_news_3',
      title: 'AMD Ryzen 9 9950X Tahtı Devraldı: Dünyanın En Hızlı Masaüstü İşlemcisi',
      sourceName: 'TechPowerUp',
      category: 'cpu' as const,
      publishedAt: new Date(),
      imageUrl: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=1600&q=85',
      tweetText: 'Zen 5 mimarili 16 çekirdekli Ryzen 9 9950X, tekli ve çoklu çekirdekte Intel Core i9-14900KS yi geride bıraktı.',
    },
  ];

  console.log('1. Adım: Güncel 9:16 TeknoFiltre Slayt Kartları Üretiliyor...');
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
    console.log(`   ✅ Slayt ${i + 1}/${newsItems.length} oluşturuldu: ${path.basename(cardPath)}`);
    slideCards.push(cardPath);
  }

  // 2. Gemini AI ile her haberi 1-e-1 kapsayan segmentli seslendirme metni üretimi
  console.log('\n2. Adım: Gemini 3.6 Flash ile Segmentli Reels Spiker Metni Üretiliyor...');
  const scriptResult = await generateReelsDigestScript(newsItems);

  console.log(`   🎯 Kanca Başlığı: "${scriptResult.hookTitle}"`);
  console.log(`   📑 Üretilen Segment Sayısı: ${scriptResult.segments.length}/${newsItems.length}`);
  scriptResult.segments.forEach((seg, idx) => {
    console.log(`      [Haber ${idx + 1}]: ${seg.script}`);
  });
  console.log(`   💬 Outro: ${scriptResult.outroScript}`);

  // 3. Segment bazlı TTS ile her slaytın ses süresini hesapla ve sesleri birleştir
  console.log('\n3. Adım: Edge TTS (EmelNeural - Kadın Spiker) ile Segment Bazlı Seslendirme & Senkron Altyazı Üretiliyor...');
  const ttsSegments = scriptResult.segments.map((seg, idx) => ({
    articleIndex: seg.articleIndex,
    text:
      idx === scriptResult.segments.length - 1
        ? `${seg.script} ${scriptResult.outroScript}`
        : seg.script,
  }));

  const ttsResult = await generateSegmentedVoiceoverWithSubtitles(ttsSegments, {
    voice: 'tr-TR-EmelNeural',
    baseFileName: 'reels_emel_demo',
    wordsPerCue: 3,
  });

  console.log(`   ✅ Seslendirme tamamlandı. Toplam süre: ${ttsResult.totalDurationSeconds} sn`);
  console.log(`   ⏱️ Slayt Süreleri: [${ttsResult.slideDurations.map((d) => `${d}s`).join(', ')}]`);
  console.log(`   📁 Birleştirilmiş Ses: ${path.basename(ttsResult.masterAudioPath)}`);
  console.log(`   📁 Karaoke Altyazı (ASS): ${path.basename(ttsResult.masterAssPath)}`);

  // 4. FFmpeg ile Video, Ses, Slayt Geçişleri (smoothleft), Ducked Beat ve Doğru Konumlandırılmış Altyazıyı Sentezle
  console.log('\n4. Adım: FFmpeg ile Video + Geçişler + Ses + Karaoke Altyazı Sentezleniyor...');
  const outVideo = path.join(process.cwd(), 'output', 'videos', 'test_reels_emel.mp4');

  await generateDigestReel(slideCards, outVideo, {
    voiceoverAudioPath: ttsResult.masterAudioPath,
    subtitlesPath: ttsResult.masterAssPath,
    slideDurations: ttsResult.slideDurations,
    transitionType: 'smoothleft',
    transitionDuration: 0.35,
  });

  console.log('\n🎉 GÜNCEL TEKNOFİLTRE REELS VİDEOSU BAŞARIYLA OLUŞTURULDU!');
  console.log(`📁 Video: ${outVideo}`);
  console.log(`📊 Boyut: ${(fs.statSync(outVideo).size / 1024 / 1024).toFixed(2)} MB`);
}

testReelsPipeline().catch(console.error);
