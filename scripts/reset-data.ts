import 'dotenv/config';
import { db } from '../src/db/index.js';
import {
  rawArticles,
  processedArticles,
  publishedTweets,
  publishedInstagramPosts,
  instagramDigests,
  dailyStats,
} from '../src/db/schema.js';
import { redis } from '../src/lib/redis.js';

async function resetData() {
  console.log('🧹 TeknoFiltre için eski veriler temizleniyor...\n');

  try {
    // 1. Veritabanı tablolarını temizle
    console.log('1. PostgreSQL tabloları temizleniyor...');
    await db.delete(publishedTweets);
    await db.delete(publishedInstagramPosts);
    await db.delete(instagramDigests);
    await db.delete(processedArticles);
    await db.delete(rawArticles);
    await db.delete(dailyStats);
    console.log('   ✅ PostgreSQL tabloları başarıyla sıfırlandı.');

    // 2. Redis önbelleği ve eski BullMQ işlerini temizle
    console.log('2. Redis önbelleği (dedup ve kuyruklar) temizleniyor...');
    await redis.flushdb();
    console.log('   ✅ Redis önbelleği tamamen sıfırlandı.');

    console.log('\n🎉 TEKNOFİLTRE İÇİN SİSTEM TERTEMİZ BAŞLATILMAYA HAZIR!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Temizleme sırasında hata:', error);
    process.exit(1);
  }
}

resetData();
