---
trigger: always_on
---

# AutoSocial Proje Bağlamı ve Kararları

## Proje Nedir?
AutoSocial; haber kaynaklarından otomatik içerik toplayıp Gemini AI ile özetleyen,
Telegram bot üzerinden hibrit onay akışıyla X (Twitter) ve Instagram'a belirli saatlerde
yayın yapan bir otomasyon sistemidir.

## Mevcut X ve Instagram Hesabı Durumu
- X: 406 takipçi (2022'den beri pasif, tüm eski tweetler silindi, sıfırdan başlıyor)
- X Premium aboneliği alınacak (gelir paylaşımı için zorunlu)
- Instagram: @bekirdev43 (Business Account olarak bağlandı)
- Başlangıç hedefi: Telegram üzerinden onaylı (hibrit) mod (otomatik moda geçiş sonradan)

## Kesinleşmiş Teknik Kararlar

### Görsel Strateji: Sharp Template
- Unsplash ve Pexels API'leri kullanım sözleşmeleri (ToS) nedeniyle reddedildi.
- Sharp kütüphanesiyle kod tarafında otomatik görsel üretimi yapılıyor.
- Her tweet/post için ~50ms'de kategori rengine göre gradient arka planlı (jpg/webp) kart üretilir.
- Instagram için görseller statik dosya sunucusu üzerinden dışarı açılır.

### Tünel Çözümü (Instagram Graph API İçin)
- Ngrok npm paketi Windows Defender'a takıldığı için kullanılmıyor.
- Localtunnel, "Bypass/Phishing" uyarı ekranı nedeniyle Instagram Graph API'de `Only photo or video can be accepted` hatası verdiği için reddedildi.
- **Karar:** `cloudflared` (Cloudflare Tunnel) kullanılıyor. `./cloudflared.exe tunnel --url http://localhost:3000` komutuyla Instagram'ın kabul edeceği, uyarı ekransız ve stabil bir tünel açılıyor.

### API Listesi (Kesinleşmiş)
1. X Developer API 
2. Gemini API Key (Gemini 3.5 Flash veya 3.6 Flash öncelikli - 1.5 sürümleri KESİNLİKLE KULLANILMAMALI)
3. Telegram Bot Token 
4. Facebook Graph API (Instagram System User Never-Expiring Token)

### DB & Queue Yönetimi (Idempotency)
- Veritabanı: PostgreSQL (Drizzle ORM) + Redis
- Kuyruk: BullMQ (Retry mekanizması: attempts: 3)
- **Mükerrer Paylaşım Koruması:** BullMQ retry mekanizmasının X ve Instagram'da aynı içeriği defalarca paylaşmaması için `publishWorker` içinde idempotency mantığı kuruldu (DB üzerinden kontrol yapılıyor).

## .env Durumu
Şu anda `.env` dosyasında başarıyla kurulan anahtarlar:
- GEMINI_API_KEY
- X_... (Tüm Twitter API anahtarları)
- TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
- IG_ACCESS_TOKEN, IG_ACCOUNT_ID
- APP_PUBLIC_URL (localhost.run adresi)
Eksik: DATABASE_URL, REDIS_URL (Canlıya çıkarken Railway için eklenecek, şu an lokal Docker kullanılıyor)

## Geliştirme Fazları ve Güncel Durum
- Faz 1: Proje iskeleti + DB şeması + RSS fetcher + Gemini özetleme + temel X API ✅
- Faz 2: Skorlama + deduplication + moderasyon + cron + BullMQ + rate limit ✅
- Faz 3: Telegram bot onay akışı + Sharp görsel üretimi + Instagram Entegrasyonu + Idempotency ✅
- Faz 4: Analytics + haftalık rapor + ton sistemi + thread desteği (Analytics ve rapor eklendi, diğerleri geliştirilecek) ⏳
- Faz 5: Railway deploy + CI/CD + alarm sistemi (Bekliyor) ⏳

**Şu anki durum:** Faz 1, 2 ve 3 tamamen bitirildi ve başarılı şekilde test edildi. X ve Instagram'a Telegram onaylı çoklu platform gönderimi (idempotency güvenliğiyle) yapılıyor. Sıradaki hedef Faz 4'teki eksikler (ton sistemi vb.) veya Faz 5 (Canlıya Alma).

## İçerik Stratejisi
- Günde 8-15 tweet/post (sabah/öğle/akşam/gece dağılımı)
- Hafta sonu %30 azaltma (insan davranışı simülasyonu)
- Tweet metni max 200 karakter + 1-2 hashtag + kaynak
- Link ilk yoruma eklenir (X algoritması dış link içeren tweetleri bastırdığı için)
- Random jitter: ±1-12 dakika sapma (bot tespitine karşı)
- Min skor eşiği: 70/100 (freshness %40 + keyword %30 + kaynak %20 + kalite %10)