/**
 * Test betik: Sharp görsel üretimini test et
 * Kullanım: pnpm test:image
 */
import 'dotenv/config';
import { generateNewsCard } from '../src/modules/processor/image.js';
import { existsSync } from 'fs';

const TEST_CASES = [
  {
    title: "AMD Ryzen 9 9950X Review: Zen 5 ile Rekor İşlemci Performansı",
    imageHook: "Dünyanın En Hızlı İşlemcisi",
    sourceName: "Tom's Hardware",
    category: 'cpu' as const,
    publishedAt: new Date(),
    id: 'test-cpu-001',
    imageUrl: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=1600&q=85',
  },
  {
    title: "NVIDIA RTX 5090 Ti Sızdırıldı: 32GB GDDR7, 600W TDP",
    imageHook: "600W Güç Çeken Canavar!",
    sourceName: "VideoCardz",
    category: 'gpu' as const,
    publishedAt: new Date(),
    id: 'test-gpu-001',
    imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=1600&q=85',
  },
  {
    title: "🔥 Samsung 990 Pro 2TB SSD Tarihinin En Düşük Fiyatına Düştü",
    imageHook: "Tarihin En Düşük SSD Fiyatı",
    sourceName: "TechRadar",
    category: 'deals' as const,
    publishedAt: new Date(),
    id: 'test-deals-001',
    imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=1600&q=85',
  },
  {
    title: "Corsair K70 Pro TKL Mechanical Keyboard: Red Switch Sessizlik mi Hız mı?",
    imageHook: "Sessiz ve Işık Hızında!",
    sourceName: "PCMag",
    category: 'peripherals' as const,
    publishedAt: new Date(),
    id: 'test-peripherals-001',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1600&q=85',
  },
  {
    title: "Logitech refreshes legendary Blue Yeti microphone with 3D voice tracking and AI denoising",
    imageHook: "Yapay Zekalı Yeni Blue Yeti!",
    sourceName: "Tom's Hardware",
    category: 'peripherals' as const,
    publishedAt: new Date(),
    id: 'test-real-tomshardware',
    imageUrl: 'https://cdn.mos.cms.futurecdn.net/rzUXEmUpCTLBZQSwXwkxAA-1920-80.jpg',
  },
];

async function main() {
  console.log('\n🧪 Sharp Gerçek Donanım Görseli ile Üretim Testi\n');

  for (const testCase of TEST_CASES) {
    console.log(`🎨 Görsel üretiliyor: ${testCase.category} [${testCase.sourceName}]`);
    console.log(`   Kanca: "${testCase.imageHook}"`);
    console.log(`   Görsel URL: ${testCase.imageUrl}`);

    try {
      const result = await generateNewsCard(
        testCase.imageHook,
        testCase.sourceName,
        testCase.category,
        testCase.publishedAt,
        testCase.id,
        '16:9',
        testCase.imageUrl,
      );

      if (existsSync(result.imagePath)) {
        console.log(`✅ Görsel oluşturuldu: ${result.imagePath} [Kaynak: ${result.imageSource}]`);
      } else {
        console.error(`❌ Görsel dosyası bulunamadı: ${result.imagePath}`);
      }
    } catch (error) {
      console.error('❌ Hata:', error instanceof Error ? error.message : error);
    }

    console.log('');
  }

  console.log('✅ Görsel testi tamamlandı');
  console.log('📁 Görselleri şuraya bakın: ./output/images/\n');
}

main().catch(console.error);
