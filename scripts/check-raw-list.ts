import 'dotenv/config';
import { db } from '../src/db/index.js';
import { rawArticles } from '../src/db/schema.js';
import { desc, count } from 'drizzle-orm';

async function main() {
  const [c] = await db.select({ c: count() }).from(rawArticles);
  console.log('Toplam işlenmeye çalışılan (rawArticles):', c?.c);

  const raws = await db.select().from(rawArticles).orderBy(desc(rawArticles.fetchedAt));
  console.log('\n--- Gemini Analizine Giren Tüm Ham Haberler ---');
  raws.forEach((r, i) => {
    console.log(`${i + 1}. [${r.fetchedAt?.toLocaleTimeString('tr-TR')}] ${r.title}`);
  });

  process.exit(0);
}

main().catch(console.error);
