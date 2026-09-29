import 'dotenv/config';
import { db } from '../src/db/index.js';
import { rawArticles, processedArticles, publishedTweets } from '../src/db/schema.js';
import { desc, count } from 'drizzle-orm';
import { redis } from '../src/lib/redis.js';

async function main() {
  console.log('\n--- VERİTABANI VE REDIS ANALİZİ ---');
  
  const [rawCount] = await db.select({ c: count() }).from(rawArticles);
  const [procCount] = await db.select({ c: count() }).from(processedArticles);
  const [tweetCount] = await db.select({ c: count() }).from(publishedTweets);

  console.log('Toplam Ham Haber (rawArticles):', rawCount?.c);
  console.log('Toplam İşlenmiş Haber (processedArticles):', procCount?.c);
  console.log('Toplam Yayınlanmış Tweet (publishedTweets):', tweetCount?.c);

  const latestRaw = await db
    .select({
      id: rawArticles.id,
      title: rawArticles.title,
      fetchedAt: rawArticles.fetchedAt,
      publishedAt: rawArticles.publishedAt,
    })
    .from(rawArticles)
    .orderBy(desc(rawArticles.fetchedAt))
    .limit(8);

  console.log('\nEn Son Kaydedilen 8 Haber:');
  for (let i = 0; i < latestRaw.length; i++) {
    const r = latestRaw[i]!;
    console.log(`${i + 1}. [Çekilme: ${r.fetchedAt ? new Date(r.fetchedAt).toLocaleString('tr-TR') : 'YOK'}] ${r.title}`);
  }

  // Redis'te kaç adet anahtar var?
  const dbsize = await redis.dbsize();
  console.log('\nRedis Toplam Anahtar Sayısı (Önbellek):', dbsize);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
