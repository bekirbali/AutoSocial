---
trigger: always_on
---

# AutoSocial Proje Bağlamı ve Kararları

## Proje Nedir?
AutoSocial; PC donanım, çevre birimleri, oyun ve akıllı telefon/mobil teknoloji (iPhone, Samsung vb.)
haber kaynaklarından otomatik içerik toplayıp Gemini AI ile özetleyen,
Telegram bot üzerinden hibrit onay akışıyla X (Twitter) ve Instagram'a belirli saatlerde
yayın yapan bir otomasyon sistemidir.

## Mevcut X ve Instagram Hesabı Durumu
- X: 406 takipçi (2022'den beri pasif, tüm eski tweetler silindi, sıfırdan başlıyor)
- X Premium aboneliği alınacak (gelir paylaşımı için zorunlu)
- Instagram: @bekirdev43 (Business Account olarak bağlandı)
- Başlangıç hedefi: Telegram üzerinden onaylı (hibrit) mod (otomatik moda geçiş sonradan)

## Kesinleşmiş Teknik Kararlar

### Sosyal Medya Marka Kimliği ve Tasarım Değişmezleri (Invariants)
1. **Marka İsmi (DonanımPost):**
   - X (Twitter), Instagram, Telegram bildirimleri ve üretilen tüm görsel/video kartlarında marka adı istisnasız **DonanımPost** olarak geçer.
   - "AutoSocial" yalnızca dahili kod tabanı / repo adıdır; kartların üzerinde, video şablonlarında veya dışa dönük hiçbir içerikte **ASLA** görünemez.

2. **Kategori Adları ve Rozetleri Yasağı:**
   - Sharp ile üretilen hiçbir görsel/video şablonunda (16:9 X kartı, 9:16 Instagram Reels kartı vb.) kategori adı veya kategori rozeti **KESİNLİKLE KULLANILMAZ**.
   - Kategori sınıflandırması (`cpu`, `gpu`, `mobile` vb.) yalnızca sistemin iç mantığında (skorlama, filtreleme, DB) kullanılır; şablon tasarımlarına basılmaz.

### Görsel ve Video Stratejisi: Sharp Template + Instagram Reels (FFmpeg)
- Unsplash ve Pexels API'leri kullanım sözleşmeleri (ToS) nedeniyle reddedildi.
- Marka ismi kartlarda ve şablonlarda **DonanımPost** olarak geçer (AutoSocial kullanılmaz).
- Şablonlarda kategori rozeti kullanılmaz (tüm görsel şablonlardan kaldırılmıştır).
- **X (Twitter):** 16:9 formatında (`1200x675`) orijinal görselli veya zarif gradient arka planlı JPEG kart üretilir. Günde 8–15 tweet ile anlık ve hızlı haber akışı sürdürülür.
- **Instagram Daily Digest (Toplu Haber Bülteni - 13:00 ve 19:00):** Instagram hesabını algoritmik yamyamlaşma (cannibalization) ve spam kısıtlamasından korumak için tek tek 8-15 reels atılmaz. Bunun yerine X'te yayınlanan onaylı haberler günde iki kez (**13:00 Öğle Bülteni** ve **19:00 Akşam Bülteni**) toplanır. Sharp ile numaralandırılmış (`ÖĞLE BÜLTENİ • 1/3`) 9:16 dikey kartlar üretilir. Okunabilirliği korumak için kartlar ekranda statik ve net durur; FFmpeg ile 4-4.5'er saniyelik slaytlar ve `assets/audio/` ritmik teknoloji müziğiyle birleştirilerek 15–30 saniyelik (maksimum 7 haber) tek bir Reels bülteni oluşturulur. Telegram üzerinden onaylanıp yayınlanır (ayrıca `/bulten` komutu ile manuel tetiklenebilir).
- **Görsel Fallback (OpenGraph):** SamMobile gibi RSS XML akışına resim koymayan kaynaklar için `extractOpenGraphImage` üzerinden sayfanın orijinal kapak fotoğrafı otomatik çekilir.
- **Reels Yayınlama:** Meta Graph API üçüncü parti uygulamalara telifli müzik seçimi izni vermediği için müzik doğrudan MP4 dosyasına gömülür. `media_type: 'REELS'`, `share_to_feed: true` ve Meta video kodlamasını takip eden `waitForMediaContainerReady` polling mekanizmasıyla profil ızgarasında da çıkacak şekilde yayınlanır.
- **Platform Medya Ayrımı:** `publishWorker` içinde X için 16:9 JPEG kartı (`article.imagePath`), Instagram için ise 9:16 Reels bülteni (`digestManager.ts` / `instagramDigests`) kullanılır.
- Instagram için medya statik dosya sunucusu üzerinden dışarı açılır.

### İçerik Nişi ve Kaynaklar
- **Odak Alanları:** PC Donanım (CPU, GPU, RAM, vb.), Çevre Birimleri, Akıllı Telefon & Mobil Teknoloji (Apple/iPhone, Samsung/Galaxy, Xiaomi vb.), Oyun ve Fırsatlar.
- **Mobil Kaynakları:** GSMArena (5/5), 9to5Mac (5/5), SamMobile (4/4).
- **Fiyat & Fırsat Koruması:** Ürün lansmanlarının ("fiyatı açıklandı", "satışa çıktı") yanlışlıkla indirim (`deals`) sanılmaması için deals anahtar kelimeleri spesifikleştirilmiştir (`indirimli satış`, `fiyat indirimi` vb.).

### Reddit Viral Teknoloji & Video Arbitraj Stratejisi
- **Kritik Amaç:** Reddit, projede sıradan bir kaynak değil; teknoloji, robotik (örn: mağazada müşteriye tepki veren robotlar, fabrika kazaları), yapay zeka demoları, şaşırtıcı donanım/cihazlar ve sıra dışı inovasyon anlarını içeren videoları henüz patlama safhasındayken (early-stage) yakalayıp X ve Instagram'da ilk paylaşarak viral organik trafik toplama aracıdır.
- **Hedef Subreddit Havuzu:** `r/robotics`, `r/singularity`, `r/technology`, `r/gadgets`, `r/EngineeringPorn`, `r/Damnthatsinteresting`, `r/Futurology` ve teknolojik viral anlar.
- **Keşif Mantığı:** "Hot" yerine özellikle "Rising" (yükselenler) veya saatlik ivmeli gönderiler taranarak, henüz diğer sosyal medya hesapları fark etmeden yakalanır.
- **API Durumu:** `reddit.com/prefs/apps` üzerinden script oluşturabilmek için de resmi API başvurusu yapılıp onay alınması gerekmektedir (şu ana kadar 2 kez başvuru yapılmış ve ikisinde de ret alınmıştır; başvuru süreçleri veya alternatif yollar buna göre ele alınmalıdır).
- **İşleme Akışı:** Video kaynağı `mediaDownloader.ts` (yt-dlp) ile indirilir, Gemini ile vurucu Türkçe tweet ve Instagram açıklaması üretilir, Telegram onayı üzerinden onaylanıp doğrudan video olarak yayınlanır.

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
- Tweet metni max 240-270 karakter, **hashtag KULLANILMIYOR**.
- **Thread (Zincir) KULLANILMIYOR:** X'te tüm içerikler tekil, vurucu ve bağımsız bir tweettir. "Detaylar zincirde", "detaylar aşağıda", "devamı flood'da" gibi ifadeler KESİNLİKLE YASAKTIR. Tüm hap bilgi ve kanca tek tweette toplanır. (Thread desteği ileride X Premium alınınca tekrar değerlendirilecektir).
- Link veya kaynak ikinci bir tweet (thread/reply) olarak **EKLENMİYOR**. Gerekirse içerikte kaynak adı (Örn: "Tom's Hardware'in haberine göre...") veriliyor.
- Random jitter: ±1-12 dakika sapma (bot tespitine karşı)
- Min skor eşiği: 70/100 (freshness %40 + keyword %30 + kaynak %20 + kalite %10)