import 'dotenv/config';
import { sendApprovalRequest } from '../src/modules/telegram/bot.js';

async function main() {
  console.log('Telegram test ediliyor...');
  const success = await sendApprovalRequest({
    articleId: 'test-article-id',
    tweetText: 'Bu bir test tweetidir. Otomasyon sistemi başarıyla çalışıyor! 🚀 #AutoSocial #Test',
    score: 85,
    category: 'Test & Geliştirme',
    sourceUrl: 'https://example.com/test-haber'
  });

  if (success) {
    console.log('✅ Telegram mesajı başarıyla gönderildi!');
  } else {
    console.log('❌ Telegram mesajı gönderilemedi.');
  }
  process.exit(0);
}

main();
