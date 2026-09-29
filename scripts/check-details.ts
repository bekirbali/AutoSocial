import 'dotenv/config';
import { db } from '../src/db/index.js';
import { rawArticles, processedArticles } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';
import { processQueue } from '../src/lib/queue.js';

async function main() {
  const counts = await processQueue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
  console.log('--- PROCESS QUEUE SAYILARI ---');
  console.log(counts);

  const raw = await db.select().from(rawArticles).orderBy(desc(rawArticles.fetchedAt)).limit(10);
  console.log('\n--- SON RAW ARTICLES (' + raw.length + ' adet) ---');
  raw.forEach((r, i) => console.log(`${i + 1}. [${r.fetchedAt?.toISOString()}] ${r.title}`));

  const proc = await db.select().from(processedArticles).orderBy(desc(processedArticles.createdAt)).limit(10);
  console.log('\n--- SON PROCESSED ARTICLES (' + proc.length + ' adet) ---');
  proc.forEach((p, i) => console.log(`${i + 1}. [${p.status}] [Skor: ${p.score}] ${p.tweetText.slice(0, 70)}...`));

  process.exit(0);
}

main().catch(console.error);
