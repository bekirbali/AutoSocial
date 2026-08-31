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
    sourceName: "Tom's Hardware",
    category: 'cpu' as const,
    publishedAt: new Date(),
    id: 'test-cpu-001',
  },
  {
    title: "NVIDIA RTX 5090 Ti Sızdırıldı: 32GB GDDR7, 600W TDP",
    sourceName: "VideoCardz",
    category: 'gpu' as const,
    publishedAt: new Date(),
    id: 'test-gpu-001',
  },
  {
    title: "🔥 Samsung 990 Pro 2TB SSD Tarihinin En Düşük Fiyatına Düştü",
    sourceName: "TechRadar",
    category: 'deals' as const,
    publishedAt: new Date(),
    id: 'test-deals-001',
  },
  {
    title: "Corsair K70 Pro TKL Mechanical Keyboard: Red Switch Sessizlik mi Hız mı?",
    sourceName: "PCMag",
    category: 'peripherals' as const,
    publishedAt: new Date(),
    id: 'test-peripherals-001',
  },
];

async function main() {
  console.log('\n🧪 Sharp Görsel Üretim Testi\n');

  for (const testCase of TEST_CASES) {
    console.log(`🎨 Görsel üretiliyor: ${testCase.category}`);
    console.log(`   Başlık: ${testCase.title.substring(0, 60)}...`);

    try {
      const result = await generateNewsCard(
        testCase.title,
        testCase.sourceName,
        testCase.category,
        testCase.publishedAt,
        testCase.id,
      );

      if (existsSync(result.imagePath)) {
        console.log(`✅ Görsel oluşturuldu: ${result.imagePath}`);
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
