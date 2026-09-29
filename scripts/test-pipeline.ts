import 'dotenv/config';
import { fetchAllSources } from '../src/modules/fetcher/index.js';
import { processArticle } from '../src/modules/processor/index.js';

async function testPipeline() {
  console.log('🔍 Canlı RSS Pipeline Testi Başlatılıyor...\n');
  
  const items = await fetchAllSources();
  console.log(`📡 Toplam ${items.length} haber çekildi.`);

  if (items.length === 0) {
    console.log('❌ Hiç haber çekilemedi!');
    process.exit(1);
  }

  console.log(`\nİlk 5 haberi pipeline\'a sokuyoruz:`);
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const item = items[i]!;
    console.log(`\n--- [Haber ${i + 1}] ${item.title} ---`);
    console.log(`Kaynak: ${item.sourceName} | Tarih: ${item.publishedAt.toISOString()}`);
    try {
      const res = await processArticle(item);
      console.log('Sonuç:', res);
    } catch (err: any) {
      console.error('❌ İşleme Hatası:', err.message);
      if (err.stack) console.error(err.stack);
    }
  }

  process.exit(0);
}

testPipeline().catch(console.error);
