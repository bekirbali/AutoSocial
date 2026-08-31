/**
 * Test betik: RSS çekmeyi test et
 * Kullanım: pnpm test:fetch
 */
import 'dotenv/config';
import { fetchRssFeed } from '../src/modules/fetcher/rss.js';
import { SOURCES } from '../src/config/sources.js';

async function main() {
  console.log('\n🧪 RSS Fetch Testi\n');

  // İlk kaynaktan test et
  const testSource = SOURCES[0]!;
  console.log(`📡 Kaynak: ${testSource.name}`);
  console.log(`🔗 URL: ${testSource.rssUrl}\n`);

  try {
    const items = await fetchRssFeed(testSource, 5);
    console.log(`✅ ${items.length} makale çekildi:\n`);

    items.forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
      console.log(`   URL: ${item.url}`);
      console.log(`   Tarih: ${item.publishedAt.toISOString()}`);
      console.log(`   Görsel: ${item.imageUrl ?? '(yok)'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Hata:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
