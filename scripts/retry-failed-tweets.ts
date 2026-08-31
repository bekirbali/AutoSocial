import { db } from '../src/db/index.js';
import { processedArticles } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const result = await db.update(processedArticles)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(processedArticles.status, 'failed'))
    .returning({ id: processedArticles.id });
    
  console.log(`Güncellenen makale sayısı: ${result.length}`);
  for (const r of result) {
    console.log(`- ${r.id}`);
  }
  process.exit(0);
}

main().catch(console.error);
