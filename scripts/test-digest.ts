import 'dotenv/config';
import { generateDigestSlideCard } from '../src/modules/processor/image.js';
import { generateDigestReel } from '../src/modules/processor/digestGenerator.js';
import { generateDigestCaption } from '../src/modules/processor/ai.js';
import { existsSync, statSync } from 'fs';
import path from 'path';

async function runDigestTest() {
  console.log('🚀 Toplu Bülten (Digest) Testi Başlıyor...\n');

  const mockArticles = [
    {
      id: 'test-1',
      title: "Nvidia RTX 5080'in Çıkış Tarihi ve VRAM Özellikleri Sızdırıldı",
      sourceName: "Tom's Hardware",
      category: 'gpu' as const,
      publishedAt: new Date(),
      imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=1200&q=80',
      tweetText: "Nvidia RTX 5080 için beklenen lansman tarihi sızdırıldı. 16GB GDDR7 bellek ve rekor bant genişliği geliyor.",
    },
    {
      id: 'test-2',
      title: "Apple Yeni Nesil M4 Max MacBook Pro Modellerini Resmen Duyurdu",
      sourceName: "9to5Mac",
      category: 'mobile' as const,
      publishedAt: new Date(),
      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&q=80',
      tweetText: "Apple, M4 Max çipli yeni MacBook Pro'ları tanıttı. Yapay zeka ve video render testlerinde %40 performans artışı vadediyor.",
    },
    {
      id: 'test-3',
      title: "Steam Bahar İndirimleri Başladı: İşte Kaçırılmayacak Fırsatlar",
      sourceName: "PC Gamer",
      category: 'gaming' as const,
      publishedAt: new Date(),
      imageUrl: null, // Görselsiz test — gradient template fallback kontrolü
      tweetText: "Steam'de yılın en büyük indirim haftası başladı. Yüzlerce AAA oyunda %75'e varan dev indirimler var.",
    },
  ];

  console.log('1. Adım: 3 adet 9:16 Slayt Kartı Üretiliyor (Sharp)...');
  const slideCards: string[] = [];

  for (let i = 0; i < mockArticles.length; i++) {
    const a = mockArticles[i]!;
    const cardPath = await generateDigestSlideCard({
      title: a.title,
      sourceName: a.sourceName,
      category: a.category,
      publishedAt: a.publishedAt,
      articleId: a.id,
      imageUrl: a.imageUrl,
      slideIndex: i + 1,
      totalSlides: mockArticles.length,
      digestType: 'noon',
    });
    console.log(`   ✅ Slayt ${i + 1}/${mockArticles.length} oluşturuldu: ${path.basename(cardPath)}`);
    slideCards.push(cardPath);
  }

  console.log('\n2. Adım: Çoklu Slayt Reels Videosu Derleniyor (FFmpeg)...');
  const outputVideoPath = path.join(process.cwd(), 'output', 'videos', 'test_digest_reel.mp4');
  await generateDigestReel(slideCards, outputVideoPath, { durationPerSlideSeconds: 4.5 });

  if (existsSync(outputVideoPath)) {
    const stats = statSync(outputVideoPath);
    console.log(`   ✅ MP4 Video başarıyla oluşturuldu!`);
    console.log(`   📁 Dosya: ${outputVideoPath}`);
    console.log(`   📊 Boyut: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    throw new Error('Video dosyası oluşturulamadı!');
  }

  console.log('\n3. Adım: Gemini AI ile Ortak Instagram Açıklaması Üretiliyor...');
  const caption = await generateDigestCaption(
    mockArticles.map((a) => ({
      title: a.title,
      category: a.category,
      sourceName: a.sourceName,
      tweetText: a.tweetText,
    })),
    'noon',
  );

  console.log('   ✅ Instagram Açıklaması Başarıyla Üretildi:\n');
  console.log('--------------------------------------------------');
  console.log(caption);
  console.log('--------------------------------------------------\n');

  console.log('🎉 TÜM BÜLTEN (DIGEST) TESTLERİ BAŞARIYLA GEÇTİ!');
}

runDigestTest().catch((err) => {
  console.error('❌ Test başarısız oldu:', err);
  process.exit(1);
});
