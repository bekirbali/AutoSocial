import 'dotenv/config';
import { db } from '../src/db/index.js';
import { rawArticles } from '../src/db/schema.js';
import { scoreArticle } from '../src/modules/processor/scorer.js';
import { SOURCES } from '../src/config/sources.js';

async function check90Plus() {
  const raws = await db.select().from(rawArticles);
  console.log('Veritabanındaki toplam ham haber sayısı:', raws.length);

  let count90Plus = 0;
  let highestScore = 0;
  let highestNews = '';

  const scores: { title: string; score: number }[] = [];

  for (const r of raws) {
    const src = SOURCES.find((s) => s.id === r.sourceId);
    const reliability = src?.reliability ?? 3;

    const breakdown = scoreArticle(
      {
        url: r.url,
        title: r.title,
        summary: r.summary ?? undefined,
        imageUrl: r.imageUrl ?? undefined,
        publishedAt: r.publishedAt ? new Date(r.publishedAt) : new Date(),
        sourceId: r.sourceId ?? 'unknown',
        sourceName: src?.name ?? 'Bilinmeyen',
        lang: r.lang ?? 'en',
      },
      reliability,
    );

    scores.push({ title: r.title, score: breakdown.total });

    if (breakdown.total >= 90) {
      count90Plus++;
      console.log(`🎯 90+ PUAN: [${breakdown.total}] ${r.title}`);
    }

    if (breakdown.total > highestScore) {
      highestScore = breakdown.total;
      highestNews = r.title;
    }
  }

  // Puanlara göre sırala
  scores.sort((a, b) => b.score - a.score);

  console.log('\n--- SONUÇLAR ---');
  console.log('90 Puan ve Üzeri Haber Sayısı:', count90Plus);
  console.log(`En Yüksek Puan: ${highestScore} -> "${highestNews}"`);
  console.log('\nEn Yüksek Puan Alan İlk 5 Haber:');
  scores.slice(0, 5).forEach((s, i) => console.log(`${i + 1}. [${s.score.toFixed(1)} Puan] ${s.title}`));

  process.exit(0);
}

check90Plus().catch(console.error);
