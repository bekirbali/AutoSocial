/**
 * Test betik: Gemini AI tweet üretimini test et
 * Kullanım: pnpm test:ai
 */
import 'dotenv/config';
import { generateTweet } from '../src/modules/processor/ai.js';

const TEST_CASES = [
  {
    title: "AMD Ryzen 9 9950X Review: The Fastest Desktop Processor Ever Made",
    summary: "AMD's new flagship processor delivers unprecedented performance with a 16-core design based on Zen 5 architecture, achieving 20% IPC improvement over previous generation.",
    sourceName: "Tom's Hardware",
    category: 'cpu' as const,
  },
  {
    title: "NVIDIA RTX 5090 Ti Leaked: 32GB GDDR7, 600W TDP Confirmed",
    summary: "Leaked specifications reveal NVIDIA's upcoming flagship GPU will feature 32GB of GDDR7 memory and a staggering 600W thermal design power.",
    sourceName: "VideoCardz",
    category: 'gpu' as const,
  },
  {
    title: "Samsung 990 Pro 2TB SSD Drops to $89 at Amazon - All-Time Low",
    summary: "The Samsung 990 Pro 2TB NVMe SSD is now available at its lowest price ever, making it an exceptional value for high-performance storage.",
    sourceName: "TechRadar",
    category: 'deals' as const,
  },
];

async function main() {
  console.log('\n🧪 Gemini AI Tweet Üretim Testi\n');

  for (const testCase of TEST_CASES) {
    console.log(`\n📰 Orijinal Başlık: ${testCase.title}`);
    console.log(`📦 Kaynak: ${testCase.sourceName} | Kategori: ${testCase.category}\n`);

    try {
      const result = await generateTweet(
        testCase.title,
        testCase.summary,
        testCase.sourceName,
        testCase.category,
      );

      console.log(`✅ Tweet (${result.tweetText.length} karakter):`);
      console.log(`   "${result.tweetText}"`);
      console.log(`   Hashtags: ${result.hashtags.join(', ')}`);
      console.log(`   Ton: ${result.tone}`);
    } catch (error) {
      console.error('❌ Hata:', error instanceof Error ? error.message : error);
    }

    // Rate limit için bekleme
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n✅ Test tamamlandı\n');
}

main().catch(console.error);
