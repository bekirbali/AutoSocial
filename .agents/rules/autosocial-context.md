---
trigger: always_on
---

# AutoSocial Proje Bağlamı ve Kararları

## Proje Nedir?
AutoSocial; haber kaynaklarından otomatik içerik toplayıp Gemini AI ile özetleyen,
Telegram bot üzerinden hibrit onay akışıyla X (Twitter) hesabına belirli saatlerde
yayın yapan bir otomasyon sistemidir.

## Mevcut X Hesabı Durumu
- 406 takipçi (2022'den beri pasif, tüm eski tweetler silindi, sıfırdan başlıyor)
- X Premium aboneliği alınacak (gelir paylaşımı için zorunlu)
- Başlangıç hedefi: hibrit onay modu (otomatik moda geçiş sonradan)

## Kesinleşmiş Teknik Kararlar

### Görsel Strateji: Sharp Template (Unsplash/Pexels YOK)
- Unsplash ToS otomatik kullanımı açıkça yasaklıyor → kullanılmayacak
- Pexels ToS belirsiz → kullanılmayacak
- Karar: Sharp kütüphanesiyle kod tarafında otomatik görsel üretimi
- Her tweet için ~50ms'de kategori rengine göre gradient arka planlı kart üretilir
- Kategori bazlı gradient renkler: Ekonomi=mavi, Teknoloji=mor, Siyaset=kırmızı vb.

### API Listesi (Kesinleşmiş — 3 API, hepsi ücretsiz)
1. X Developer API — developer.twitter.com
2. Gemini API Key — aistudio.google.com (free tier yeterli: günde max 15 çağrı)
3. Telegram Bot Token — @BotFather
❌ Unsplash API — çıkarıldı (ToS ihlali)
❌ Pexels API — çıkarıldı (ToS belirsiz)

### Gemini Aboneliği vs API Ayrımı
- Kullanıcının Gemini Pro (Google One AI Premium) aboneliği var
- Bu abonelik API erişimi SAĞLAMAZ — ayrı Gemini API key gerekli
- Gemini API free tier bizim için yeterli (günde 15 istek << 1500 limit)
- Imagen API (görsel üretim) ücretli olduğu için tercih edilmedi → Sharp tercih edildi

### Hosting: Railway.app
- Vercel Cron kullanılmayacak (cold start + stateful işlem sorunu)
- Railway.app üzerinde her zaman açık Node.js process
- PostgreSQL + Redis de Railway'de barındırılacak

### Teknoloji Stack (Kesinleşmiş)
- Runtime: Node.js 20+ / TypeScript
- Package manager: pnpm
- DB: PostgreSQL (Drizzle ORM) + Redis (URL hash cache + BullMQ)
- Queue: BullMQ
- AI: Gemini 1.5 Flash (öncelik) / Pro (önemli haberler)
- Görsel: Sharp (template üretimi)
- X API: twitter-api-v2 kütüphanesi
- Telegram: Telegraf
- Log: Pino
- Env: dotenv + zod

## .env Durumu
Şu anda `.env` dosyasında mevcut anahtarlar:
- GEMINI_API_KEY ✅
- X_CLIENT_ID, X_CLIENT_SECRET ✅
- X_BEARER_TOKEN ✅
- X_CONSUMER_KEY, X_CONSUMER_KEY_SECRET ✅
- X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET ✅
- TELEGRAM_HTTP_API ✅
Eksik: DATABASE_URL, REDIS_URL (Railway deploy sonrası eklenecek)

## Geliştirme Fazları
- Faz 1: Proje iskeleti + DB şeması + RSS fetcher + Gemini özetleme + temel X API
- Faz 2: Skorlama + deduplication + moderasyon + cron + BullMQ + rate limit
- Faz 3: Telegram bot onay akışı + Sharp görsel üretimi
- Faz 4: Analytics + haftalık rapor + ton sistemi + thread desteği
- Faz 5: Railway deploy + CI/CD + alarm sistemi
Şu anki durum: Kodlamaya henüz başlanmadı, Faz 1'deyiz.

## İçerik Stratejisi
- Günde 8-15 tweet (sabah/öğle/akşam/gece dağılımı)
- Hafta sonu %30 azaltma (insan davranışı simülasyonu)
- Tweet metni max 200 karakter + 1-2 hashtag + kaynak
- Link ilk yoruma eklenir (X algoritması dış link içeren tweetleri bastırıyor)
- Random jitter: ±1-12 dakika sapma (bot tespitine karşı)
- Min skor eşiği: 70/100 (freshness %40 + keyword %30 + kaynak %20 + kalite %10)
