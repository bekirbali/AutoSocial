import { db } from '../src/db/index.js';
import { instagramDigests, processedArticles } from '../src/db/schema.js';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';

async function fixRejectedDigests() {
  // Instagram'da yayınlanmış (igMediaId ve igPostUrl dolu) ama status 'rejected' kalmış bültenleri bul
  const wrongDigests = await db
    .select()
    .from(instagramDigests)
    .where(
      and(
        eq(instagramDigests.status, 'rejected'),
        isNotNull(instagramDigests.igMediaId),
        isNotNull(instagramDigests.igPostUrl)
      )
    );

  console.log(`Düzeltilecek bülten sayısı: ${wrongDigests.length}`);

  for (const d of wrongDigests) {
    console.log(`Düzeltiliyor: ${d.id} (${d.igPostUrl})`);

    // Status'ü published yap
    await db
      .update(instagramDigests)
      .set({
        status: 'published',
        publishedAt: d.publishedAt || d.updatedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instagramDigests.id, d.id));

    // Makaleleri includedInDigest olarak işaretle
    if (d.articleIds && d.articleIds.length > 0) {
      await db
        .update(processedArticles)
        .set({ includedInDigest: true, updatedAt: new Date() })
        .where(inArray(processedArticles.id, d.articleIds));
    }
  }

  console.log('✅ Hatalı bülten kayıtları başarıyla düzeltildi.');
  process.exit(0);
}

fixRejectedDigests().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
