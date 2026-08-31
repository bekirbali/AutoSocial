/**
 * Test betik: X API bağlantısını test et — GERÇEK TWEET ATAR!
 * Kullanım: pnpm test:tweet
 *
 * ⚠️ Bu betik gerçek tweet atar. Sadece test hesabında kullan.
 * Silmek için tweet URL'sini konsola yazar.
 */
import 'dotenv/config';
import { twitterClient } from '../src/modules/publisher/twitter.js';

async function main() {
  console.log('\n🧪 X API Bağlantı Testi\n');

  try {
    // Hesap bilgilerini al
    const me = await twitterClient.v2.me();
    console.log(`✅ Kimlik doğrulama başarılı!`);
    console.log(`   Kullanıcı: @${me.data.username}`);
    console.log(`   ID: ${me.data.id}\n`);

    // Test tweet at
    const testText = `🧪 AutoSocial sistem testi — ${new Date().toISOString()}

Bu tweet otomatik sistem testi için atılmıştır. Lütfen silin.

#AutoSocial #Test`;

    console.log('📤 Test tweet atılıyor...');
    const tweet = await twitterClient.v2.tweet({ text: testText });

    console.log(`✅ Tweet atıldı!`);
    console.log(`   Tweet ID: ${tweet.data.id}`);
    console.log(`   URL: https://x.com/i/web/status/${tweet.data.id}`);
    console.log(`\n🗑️  Test tweetini silebilirsiniz:`);
    console.log(`   https://x.com/i/web/status/${tweet.data.id}\n`);

  } catch (error) {
    console.error('❌ Hata:', error instanceof Error ? error.message : error);
    console.error('\nKontrol listesi:');
    console.error('  - .env dosyasında X_CONSUMER_KEY, X_CONSUMER_KEY_SECRET var mı?');
    console.error('  - X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET var mı?');
    console.error('  - X Developer Portal\'da "Read and Write" izinleri açık mı?');
    process.exit(1);
  }
}

main();
