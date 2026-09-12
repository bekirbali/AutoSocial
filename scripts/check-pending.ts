import 'dotenv/config';
import { db } from '../src/db/index.js';
import { processedArticles, rawArticles } from '../src/db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';

async function main() {
  console.log('--- CHECKING PENDING ARTICLES ---');

  const allPending = await db
    .select({
      id: processedArticles.id,
      status: processedArticles.status,
      score: processedArticles.score,
      createdAt: processedArticles.createdAt,
      title: rawArticles.title,
    })
    .from(processedArticles)
    .leftJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .where(eq(processedArticles.status, 'pending'))
    .orderBy(desc(processedArticles.createdAt));

  console.log(`Total Pending Articles: ${allPending.length}`);

  const cutoff = new Date('2026-09-11T00:00:00.000+03:00');
  console.log(`Cutoff Date (11 Eylül 00:00 TSİ): ${cutoff.toISOString()}`);

  const olderThanCutoff = allPending.filter((a) => new Date(a.createdAt) < cutoff);
  const newerOrEqual = allPending.filter((a) => new Date(a.createdAt) >= cutoff);

  console.log(`\n📅 11 Eylül'den ESKİ (Ret verilecekler): ${olderThanCutoff.length}`);
  console.log(`📅 11 Eylül ve SONRASI (Korunacaklar): ${newerOrEqual.length}`);

  console.log('\n--- Örnek 11 Eylül ve Sonrası İçerikler: ---');
  for (const item of newerOrEqual) {
    console.log(`[${new Date(item.createdAt).toLocaleString('tr-TR')}] Score: ${item.score} | ${item.title?.substring(0, 60)}`);
  }

  console.log('\n--- Örnek 11 Eylül Öncesi İçerikler: ---');
  for (const item of olderThanCutoff.slice(0, 10)) {
    console.log(`[${new Date(item.createdAt).toLocaleString('tr-TR')}] Score: ${item.score} | ${item.title?.substring(0, 60)}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
