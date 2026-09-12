import { fetchRedditVideos } from './modules/fetcher/reddit.js';
import { processArticle } from './modules/processor/index.js';
import { db } from './db/index.js';
import { processedArticles } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { sendApprovalRequest } from './modules/telegram/bot.js';

async function runTest() {
  console.log('🔄 Test başlatılıyor: Reddit üzerinden video çekiliyor...');
  try {
    // Reddit JSON API bazen 403 verdiği için test amacıyla doğrudan bir video postu veriyoruz
    const item = {
      sourceId: 'reddit',
      sourceName: 'r/PublicFreakout',
      lang: 'en',
      url: 'https://www.reddit.com/r/PublicFreakout/comments/1bbg5n9/man_gets_arrested_for_eating_a_sandwich/?test=3', // Örnek video (Gerçek video URL'si)
      title: 'Intel Core i9 14900KS processor breaks world records in latest leak test v3',
      summary: 'New CPU test leaks showing incredible performance over 13900KS.',
      publishedAt: new Date(),
      imageUrl: undefined,
      videoUrl: 'https://www.reddit.com/r/PublicFreakout/comments/1bbg5n9/man_gets_arrested_for_eating_a_sandwich/?test=3',
      mediaType: 'video' as const,
    };
    
    console.log(`✅ Video bulundu: ${item.title}`);
    console.log(`🔗 URL: ${item.videoUrl}`);

    // 2. Process (AI, Downloader, vs.)
    console.log('⚙️ İşleniyor (Video İndirme ve Gemini AI çalışıyor)...');
    const result = await processArticle(item);
    
    console.log('✅ İşlem sonucu:', result);

    if (result.status === 'processed' && result.processedArticleId) {
      console.log(`✅ Veritabanına başarıyla kaydedildi. (ID: ${result.processedArticleId})`);
      
      const articleData = await db.query.processedArticles.findFirst({
        where: eq(processedArticles.id, result.processedArticleId),
      });

      if (articleData && articleData.status === 'pending') {
        console.log('📲 Telegram onayı gönderiliyor...');
        await sendApprovalRequest({
          articleId: result.processedArticleId,
          tweetText: articleData.tweetText,
          score: Number(articleData.score),
          imagePath: articleData.imagePath ?? undefined,
          sourceUrl: item.url,
          category: articleData.category ?? 'Genel',
          threadTweets: (articleData.threadTweets as string[]) ?? undefined,
          hasReelVideo: !!articleData.videoPath,
          instagramCaption: articleData.instagramCaption ?? undefined,
        });
        console.log('✅ Telegram onayı istendi! Lütfen Telegram botunuzu kontrol edin.');
      }
    } else {
      console.log(`⚠️ Video yayınlanmak üzere seçilmedi. Sebep: ${result.reason}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Test sırasında hata:', err);
    process.exit(1);
  }
}

runTest();
