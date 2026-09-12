import 'dotenv/config';
import { db } from '../src/db/index.js';
import { processedArticles, rawArticles } from '../src/db/schema.js';
import { eq, lt, and, desc } from 'drizzle-orm';
import { syncArticleStatusToTelegram } from '../src/modules/telegram/bot.js';

async function main() {
  console.log('--- REJECTING OLD PENDING ARTICLES (< 11 Eylül 2026) ---');

  const cutoff = new Date('2026-09-11T00:00:00.000+03:00');
  console.log(`Cutoff Tarihi: ${cutoff.toISOString()} (11 Eylül 00:00 TSİ)`);

  // 1. Bul
  const oldArticles = await db
    .select({
      id: processedArticles.id,
      title: rawArticles.title,
      createdAt: processedArticles.createdAt,
    })
    .from(processedArticles)
    .leftJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
    .where(
      and(
        eq(processedArticles.status, 'pending'),
        lt(processedArticles.createdAt, cutoff)
      )
    )
    .orderBy(desc(processedArticles.createdAt));

  console.log(`Bulunan 11 Eylül öncesi onay bekleyen haber sayısı: ${oldArticles.length}`);

  if (oldArticles.length === 0) {
    console.log('Ret verilecek eski haber bulunamadı.');
    process.exit(0);
  }

  // 2. Güncelle
  const ids = oldArticles.map((a) => a.id);
  console.log(`Güncelleniyor... Toplam ${ids.length} kayıt.`);

  for (const item of oldArticles) {
    await db
      .update(processedArticles)
      .set({
        status: 'rejected',
        rejectionReason: 'Tarihi geçmiş içerik (11 Eylül öncesi eski haber temizliği)',
        updatedAt: new Date(),
      })
      .where(eq(processedArticles.id, item.id));

    // Varsa Telegram mesajını da senkronize et
    try {
      await syncArticleStatusToTelegram(item.id, 'rejected');
    } catch {
      // Telegram hatası olursa yoksay
    }
  }

  console.log(`✅ ${oldArticles.length} adet eski haber başarıyla 'rejected' durumuna getirildi.`);

  // 3. Kalan pending sayısını doğrula
  const remaining = await db
    .select({ id: processedArticles.id, createdAt: processedArticles.createdAt })
    .from(processedArticles)
    .where(eq(processedArticles.status, 'pending'));

  console.log(`\n🎉 İşlem tamamlandı! Kalan onay bekleyen (pending) haber sayısı: ${remaining.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
