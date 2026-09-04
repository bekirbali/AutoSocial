# AutoSocial - Kapsamlı Proje Mimarisi ve Geliştirici Dokümantasyonu

Bu belge, **AutoSocial** projesinin güncel (Faz 3 tamamlanmış) durumunu eksiksiz bir şekilde açıklamak, kullanılan teknolojilerin *neden* ve *nasıl* seçildiğini belgelemek ve sıfırdan aynı sistemi kurmak isteyen bir geliştiriciye rehberlik etmek amacıyla hazırlanmıştır.

---

## 1. Proje Özeti ve Amacı
**AutoSocial**, teknoloji ve donanım haberlerini (ileride genişletilebilir) RSS kaynaklarından otomatik olarak çeken, bu haberleri yapay zeka (Gemini 1.5) ile özetleyip sosyal medya formatına (X/Twitter ve Instagram) uygun hale getiren ve bir **Telegram Botu üzerinden insan onayı (hibrit mod)** aldıktan sonra otomatik olarak yayınlayan uçtan uca bir otomasyon sistemidir.

**Temel Hedefler:**
- Tamamen otonom veya yarı otonom (onaylı) içerik üretimi.
- Tıklama tuzağı (clickbait) olmayan, kaliteli ve SEO/Algoritma uyumlu sosyal medya metinleri oluşturma.
- X ve Instagram (Business) hesaplarını eşzamanlı ve limitlere (Rate Limit) takılmadan yönetme.

---

## 2. Kullanılan Teknolojiler (Stack) ve Nedenleri

Proje modern, tip güvenli (type-safe) ve ölçeklenebilir bir Node.js mimarisi üzerine kurulmuştur:

*   **Dil:** TypeScript (`tsx` ile çalıştırılıyor). (Tip güvenliği ve hata tespiti için).
*   **Veritabanı:** PostgreSQL. (İlişkisel verilerin tutulması, sağlam transaction yönetimi için).
*   **ORM:** Drizzle ORM (`drizzle-orm`, `drizzle-kit`). (Prisma'ya göre çok daha hafif, SQL'e daha yakın ve hızlı olduğu için tercih edildi).
*   **Kuyruk Sistemi (Queue):** Redis & BullMQ. (Zamanlanmış görevler (cron), asenkron işlemler ve hatalı işlemlerin tekrarı (retry/idempotency) için kusursuz bir mimari sunuyor).
*   **Yapay Zeka:** `@google/generative-ai` (Gemini 1.5 Flash). (Maliyet/performans oranı çok yüksek olduğu, hızlı çalıştığı ve büyük bağlam pencereleri sunduğu için).
*   **Görsel Üretimi:** `sharp`. (API kullanım sözleşmelerine (ToS) takılmamak için dış servisler (Unsplash vb.) iptal edildi. Sharp ile milisaniyeler içinde Node.js üzerinde özel gradient arka planlı, logolu metin görselleri üretiliyor).
*   **Bot Entegrasyonu:** `telegraf`. (Telegram Bot API'sini Node.js'de kullanmanın en modern ve stabil yolu).
*   **Sosyal Medya API'leri:** 
    *   `twitter-api-v2` (X OAuth 1.0a entegrasyonu).
    *   Facebook Graph API (`axios` ile manuel HTTP istekleri üzerinden Instagram Reels/Post gönderimi).
*   **HTTP/HTML İşleme:** `axios` (istekler), `cheerio` (web scraping/HTML parse), `rss-parser` (XML/RSS okuma).

---

## 3. Sistem Mimarisi ve İş Akışı

Sistem 4 ana BullMQ Worker'ı ve bir Cron Scheduler etrafında çalışır:

1.  **Fetcher (Veri Toplayıcı):**
    *   Belirlenen `SOURCES` (kaynaklar) listesindeki RSS linklerini düzenli tarar.
    *   Yeni bir URL bulduğunda bunu `raw_articles` tablosuna kaydeder (Mükerrer kaydı önlemek için `url_hash` ile UNIQUE constraint kullanılır).
2.  **Processor (Yapay Zeka ve Görsel İşleyici):**
    *   Ham makaleyi alır, bir kalite puanı (Score) hesaplar. Eşik değerini geçenler Gemini'ye gönderilir.
    *   Gemini'den sistem promptu ile "Tıklama tuzağı olmayan, vurucu bir Twitter ve Instagram gönderisi" istenir.
    *   Elde edilen metin ve kategoriye göre `sharp` kütüphanesi kullanılarak bir `.webp` (veya Instagram için on-the-fly `.jpeg`) görsel üretilir.
    *   Sonuç `processed_articles` tablosuna `status: 'pending'` (onay bekliyor) olarak kaydedilir.
3.  **Telegram Bot (Onay Mekanizması):**
    *   İşlenen içerik, üretilen görselle birlikte Admin'in Telegram hesabına gönderilir.
    *   Mesajın altında "Onayla (X & IG)", "Sadece X", "Reddet" gibi Inline Keyboard butonları bulunur.
    *   Admin "Onayla" dediğinde, içeriğin statüsü `queued` olur ve Yayınlama kuyruğuna (Publish Queue) eklenir.
4.  **Publisher (Yayınlayıcı):**
    *   Kuyruktan işi alır. **Idempotency** (Aynı içeriği 2 kez paylaşmama) kontrollerini yapar (Örn: Veritabanında daha önce paylaşılmış mı?).
    *   X'e görsel ve metni yükler, ardından altına kaynağın linkini "reply" olarak atar (X algoritması dış linkleri sevmediği için).
    *   Instagram için: Görselin dışarıdan erişilebilir olması gerekir. Kendi statik dosya sunucumuzdan (Cloudflared tüneli üzerinden) görseli Graph API'ye sunar ve yayınlar.
5.  **Analytics:**
    *   Yayınlanan postların gösterim, beğeni gibi istatistiklerini düzenli olarak çeker ve `published_tweets` / `daily_stats` tablolarına kaydeder.

---

## 4. Veritabanı Şeması (Drizzle ORM)

Tablo yapısı tamamen bir haberin yaşam döngüsüne göre tasarlanmıştır:

*   **`sources`**: Takip edilen RSS kaynakları, URL'leri ve güvenilirlik puanları.
*   **`raw_articles`**: RSS'den düşen saf veriler (Title, URL, Publish Date).
*   **`processed_articles`**: AI'dan dönen özet, üretilen görselin yolu (`imagePath`), onay durumu (`status`), verilecek platformlar vb.
*   **`published_tweets`**: X'e başarıyla atılan tweetlerin ID'leri ve anlık analitik (beğeni, gösterim) verileri.
*   **`published_instagram_posts`**: Instagram'a atılan medyanın ID'si ve istatistikleri.
*   **`system_logs` & `daily_stats`**: Sistem sağlığını ve günlük limit kullanımlarını takip etmek için tutulan kayıtlar.

---

## 5. Instagram Tünel Çözümü (Çok Kritik Karar)

Instagram Graph API, bir medya yüklenirken medyanın public (herkese açık) bir URL'de bulunmasını zorunlu kılar. Lokal geliştirme yaparken bu büyük bir sorundur.
*   **Ngrok:** Windows Defender tarafından "kötü amaçlı yazılım" olarak engellendiği için kullanılamadı.
*   **Localtunnel:** Araya bir "Bypass/Phishing" uyarı ekranı koyduğu için Instagram botları görseli okuyamadı (`Only photo or video can be accepted` hatası).
*   **Mevcut ve Çalışan Çözüm:** Uygulamanın `main.ts` dosyasında bir statik dosya sunucusu (port 3000) ayağa kalkar. Bu sunucu `output/images/` klasörünü dışarı açar. Bu port, `cloudflared` (Cloudflare Tunnel) veya `ssh -R 80:localhost:3000 nokey@localhost.run` komutu ile dünyaya açılır ve oluşan public URL `.env` dosyasına `APP_PUBLIC_URL` olarak verilir. Bu sayede Instagram sorunsuz şekilde görselleri çekebilir.

---

## 6. Mükerrer Paylaşım Koruması (Idempotency)

Bot sistemlerinin en büyük korkusu aynı tweeti defalarca atmaktır. BullMQ, bir job başarısız olursa onu tekrar dener (retry). Bunu önlemek için `publishWorker.ts` içinde şu mantık kurulmuştur:
1. Job başladığında, `processed_articles` tablosuna bakılır. Eğer durum zaten `published` ise job hemen iptal edilir.
2. Platform bazlı kontroller yapılır. (Örn: X başarılı, IG başarısız olduysa ve job tekrar çalışırsa, sadece IG için tekrar denenir, X atlanır).
3. DB transaction'ları ile "okuma" ve "statü güncelleme" işlemleri kitlenir.

---

## 7. Çevre Değişkenleri (.env)

Sistemi ayağa kaldırmak için gereken anahtar konfigürasyonlar:
```env
# Temel
NODE_ENV=development
APP_MODE=hybrid # veya 'auto'
APP_PUBLIC_URL=https://senin-tunel-adresin.trycloudflare.com

# Veritabanı
DATABASE_URL=postgresql://user:pass@localhost:5433/autosocial
REDIS_URL=redis://localhost:6380

# API Key'ler
GEMINI_API_KEY=AIzaSy...
TELEGRAM_BOT_TOKEN=1234:ABC...
TELEGRAM_CHAT_ID=1234567

# X (Twitter) OAuth 1.0a
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
X_BEARER_TOKEN=...

# Instagram (Facebook Graph API)
IG_ACCOUNT_ID=... # Instagram Business ID
IG_ACCESS_TOKEN=... # System User Never-Expiring Token
```

---

## 8. Kurulum ve Çalıştırma

Sıfırdan bu projeyi ayağa kaldırmak için izlenecek adımlar:

1.  **Bağımlılıklar:** `pnpm install` komutu ile tüm kütüphaneler kurulur.
2.  **Veritabanı (Docker):** `docker-compose up -d` ile Postgres ve Redis konteynerleri başlatılır.
3.  **Şema Göçü:** `pnpm db:generate` ve `pnpm db:migrate` ile Drizzle tabloları veritabanına işlenir.
4.  **Tünel Başlatma:** Ayrı bir terminalde `cloudflared tunnel --url http://localhost:3000` çalıştırılır ve verilen URL `.env` dosyasına yazılır.
5.  **Uygulamayı Başlatma:** `pnpm dev` komutu ile ana uygulama (`main.ts`) başlatılır. Uygulama otomatik olarak RSS'leri çekecek, görselleri üretecek ve onay için Telegram'a gönderecektir.
