# AutoSocial — Ürün Gereksinimleri Dökümanı (PRD)
> **Versiyon:** 1.0  
> **Tarih:** 28 Ağustos 2026  
> **Proje Adı:** AutoSocial  
> **Hedef Platform:** X (Twitter)

---

## 1. Proje Özeti

AutoSocial, haber kaynaklarından otomatik olarak içerik toplayıp işleyen, yapay zeka destekli özetler üreten ve X (Twitter) hesabı üzerinden belirli bir program dahilinde yayınlayan tam otomasyon sistemidir. Sistem; insan onaylı hibrit mod ve tam otomatik mod seçeneklerini destekler, bot tespitine karşı koruma önlemleri içerir ve zamanla gelir elde etmeye elverişli bir hesap büyütme stratejisine sahiptir.

### Bağlam & Başlangıç Noktası
- Mevcut X hesabı: **406 takipçi** (2022 sonundan bu yana pasif)
- Tüm eski tweetler silindi → hesap temiz, sıfırdan başlıyor
- X Premium aboneliği: **onaylandı** (gelir paylaşımı için zorunlu)
- Hedef: organik büyüme ile hesabı monetize edilebilir seviyeye taşımak

---

## 2. Hedefler

### Kısa Vadeli (0-3 Ay)
- [ ] Sistemi üretim ortamında ayağa kaldırmak
- [ ] Günlük 8-15 kaliteli haber paylaşımına başlamak
- [ ] Hibrit onay modeli ile içerik kalitesini manuel kontrol altında tutmak
- [ ] 500 takipçi eşiğini korumak ve üstüne çıkmak
- [ ] Bot tespitine uğramadan hesabı aktif tutmak

### Orta Vadeli (3-12 Ay)
- [ ] Tam otomatik moda geçmek (içerik kalitesi kanıtlandıktan sonra)
- [ ] Aylık görüntülenme verisini takip etmek
- [ ] Analytics döngüsüyle içerik stratejisini optimize etmek
- [ ] Sponsorlu içerik tekliflerine hazır olmak

### Uzun Vadeli (12+ Ay)
- [ ] X Ads Revenue Sharing eşiğine (5M organik görüntülenme/3 ay) ulaşmak
- [ ] Çoklu niş hesaplara ölçeklendirmek
- [ ] Çoklu platform desteği eklemek (Threads, Bluesky)

---

## 3. Sistem Mimarisi

### 3.1 Genel Veri Akışı

```
[Haber Kaynakları]
      │
      ▼
[Veri Toplama Katmanı]  ←── RSS Parser / Cheerio / Puppeteer (son çare)
      │
      ▼
[Deduplication & Filtreleme]  ←── URL hash + Semantic similarity kontrolü
      │
      ▼
[Skorlama Algoritması]  ←── Freshness + Keyword + Kaynak güvenilirliği
      │
      ▼
[AI İşleme Katmanı]  ←── Gemini API (özetleme + ton seçimi)
      │
      ▼
[Görsel İşleme]  ←── Sharp (yeniden boyutlandırma + logo)
      │
      ▼
[Onay Akışı]
   ├── Hibrit Mod: Telegram Bot → Tek tıkla onayla/reddet
   └── Tam Otomatik Mod: Doğrudan kuyruğa al
      │
      ▼
[Yayın Kuyruğu]  ←── Bull/BullMQ (Redis tabanlı)
      │
      ▼
[Cron Zamanlayıcı]  ←── Node-Cron (random jitter ile)
      │
      ▼
[X API v2]  ←── twitter-api-v2 kütüphanesi
      │
      ▼
[Analytics Toplama]  ←── Tweet metrikleri geri çek, veritabanına yaz
      │
      ▼
[Raporlama Dashboard]  ←── İsteğe bağlı, sonraki fazda
```

### 3.2 Mimari Prensipler
- **Modüler yapı:** Her katman bağımsız değiştirilebilir (RSS parser değişirse sadece o modül güncellenir)
- **Stateful:** Tüm durum bilgisi veritabanında tutulur, uygulama restart-safe olmalı
- **Idempotent:** Aynı haber birden fazla kez işlense bile tek bir kez yayınlanmalı
- **Fail-safe:** Herhangi bir katmanda hata olursa sistem çökmemeli, log tutup devam etmeli

---

## 4. Teknoloji Stack

| Katman | Teknoloji | Gerekçe |
|---|---|---|
| Runtime | **Node.js 20+ / TypeScript** | Olgun ekosistem, twitter-api-v2 ile uyumluluk |
| Package Manager | **pnpm** | Hız ve disk tasarrufu |
| Veritabanı (Ana) | **PostgreSQL** | İlişkisel veri, JSONB desteği, migration kolaylığı |
| Veritabanı (Cache) | **Redis** | URL hash cache, BullMQ kuyruğu |
| ORM | **Drizzle ORM** | TypeScript-native, hafif, type-safe |
| Kuyruk | **BullMQ** | Redis tabanlı, retry/delay/priority desteği |
| Zamanlama | **Node-Cron** | Process içinde çalışır, Vercel'e bağımlı değil |
| AI Özetleme | **Gemini 1.5 Flash API** | Hız/maliyet dengesi için Flash, kalite için Pro |
| Veri Toplama | **RSS Parser + Cheerio + Axios** | Önce RSS, sonra lightweight scraper |
| Son Çare Scraper | **Playwright** | Puppeteer'a göre daha stabil, Chromium dahil |
| Görsel İşleme | **Sharp** | Yüksek performans, binary bağımlılık minimal |
| X Entegrasyonu | **twitter-api-v2** | Resmi, en güncel v2 API desteği |
| Bildirim | **Telegraf (Telegram Bot)** | Hibrit onay modu için |
| Hosting | **Railway.app** | Her zaman açık process, ücretsiz katman, kolay deploy |
| CI/CD | **GitHub Actions** | Otomatik deploy, ücretsiz |
| Log | **Pino** | Yapılandırılmış JSON log, çok hızlı |
| Env Yönetimi | **dotenv + zod** | Tip güvenli environment variable doğrulama |

> **Neden Vercel Cron değil?**  
> Vercel serverless ortamı her tetiklemede soğuk başlar, stateful işlemleri desteklemez ve uzun süren scraping işlemleri için timeout sınırları çok düşük. Railway.app üzerinde her zaman açık bir Node.js process çok daha uygun.

---

## 5. Veri Toplama Katmanı

### 5.1 Kaynak Hiyerarşisi

```
Öncelik 1: RSS Feed (varsa kullan)
Öncelik 2: WebSub/PubSubHubbub (anlık push bildirim destekleyen kaynaklar)
Öncelik 3: Cheerio + Axios (hafif scraping)
Öncelik 4: Playwright (son çare, sadece JS-render gerektiren siteler)
```

### 5.2 RSS Çekme Döngüsü
- **Kontrol sıklığı:** Her 15 dakikada bir (ayarlanabilir)
- **WebSub destekli kaynaklar:** Anlık push alındığında hemen işle (polling yok)
- **Timeout:** Her kaynak için max 10 saniye bekleme
- **Retry:** 3 deneme, exponential backoff (5s → 15s → 45s)
- **Başarısız kaynak takibi:** 5 ardışık başarısızlıkta kaynağı geçici devre dışı bırak, log tut

### 5.3 Scraping Kuralları (Playwright kullanıldığında)
- User-Agent string her istekte rastgele rotasyon
- İstekler arasına 2-8 saniye rastgele gecikme ekle
- Robots.txt dosyasına uymak **zorunlu**
- Aynı siteye aynı anda birden fazla paralel istek gönderme

### 5.4 Toplanacak Veri Alanları
```typescript
interface RawArticle {
  url: string;              // Unique identifier
  title: string;
  summary?: string;         // RSS'ten gelen özet (varsa)
  fullText?: string;        // Tam metin (scraping ile)
  imageUrl?: string;        // Kapak görseli URL
  publishedAt: Date;
  sourceName: string;       // "TechCrunch", "BBC", vb.
  sourceId: string;         // Veritabanındaki kaynak ID
  lang: string;             // "tr" | "en"
  categories: string[];     // RSS kategorileri
}
```

---

## 6. Deduplication & Filtreleme

### 6.1 Duplicate Tespiti (Sıralı kontrol)
1. **URL hash kontrolü:** SHA-256(url) → Redis'te var mı? Varsa atla (O(1))
2. **Benzer başlık kontrolü:** Aynı gün içinde yayınlanan, %85+ benzer başlıklı haberler duplicate sayılır
   - Basit: Levenshtein distance
   - Gelişmiş: Embedding benzerliği (Gemini Embedding API)
3. **Zaman penceresi:** 24 saat içinde aynı URL'den gelen ikinci kayıt otomatik atlanır

### 6.2 Kara Liste Filtreleri
- **Domain kara listesi:** Güvenilmez veya spam siteler
- **Anahtar kelime kara listesi:** NSFW, şiddet, dezenformasyon flagleri
- **Dil filtresi:** Yalnızca hedef dil(ler)de içerik
- **Minimum içerik uzunluğu:** 100 karakterden kısa başlıklar atlanır

### 6.3 İçerik Moderasyon Katmanı
Her haber yayınlanmadan önce aşağıdaki kontroller uygulanır:

```
✓ Yasak kelime listesi taraması
✓ Kaynak güvenilirlik skoru kontrolü (whitelist/blacklist)
✓ Başlık uzunluğu ve kalite skoru
✓ Gemini API ile basit toxicity check (isteğe bağlı, ek maliyet)
```

> **Neden şart?** Otomatik sistemlerin yanlış veya zararlı içerik paylaşması X'in kalıcı hesap askıya alma nedenleri arasında. Moderasyon katmanı bu riski minimize eder.

---

## 7. Haber Skorlama Algoritması

Her haber 0-100 arasında bir **öncelik skoru** alır. Yalnızca belirlenen eşiğin (varsayılan: 60) üzerindeki haberler kuyruğa alınır.

### Skor Bileşenleri

| Faktör | Ağırlık | Hesaplama |
|---|---|---|
| **Freshness** | %40 | `max(0, 100 - (şimdikiZaman - yayınZamanı) / dakika)` → 0-100 arası |
| **Anahtar Kelime Eşleşmesi** | %30 | Niş anahtar kelime listesiyle kesişim / toplam kelime sayısı × 100 |
| **Kaynak Güvenilirliği** | %20 | Kaynak için manuel atanan puan (1-5 yıldız → 20-100) |
| **Başlık Kalitesi** | %10 | Soru işareti, sayı, aksiyon kelimesi → engagement potansiyeli tahmini |

```typescript
function calculateScore(article: RawArticle, config: ScoringConfig): number {
  const freshness = calculateFreshness(article.publishedAt);       // 0-100
  const keyword   = calculateKeywordMatch(article.title, config);  // 0-100
  const source    = getSourceReliability(article.sourceId);        // 0-100
  const quality   = calculateTitleQuality(article.title);          // 0-100

  return (freshness * 0.40) + (keyword * 0.30) + (source * 0.20) + (quality * 0.10);
}
```

### Günlük Kuota
- **Minimum:** 8 haber/gün
- **Maksimum:** 15 haber/gün
- **Kuota dolunca:** Yeni gelen haberler ertesi güne ertelenir (yüksek skor öncelikli)

---

## 8. AI İşleme Katmanı

### 8.1 Özetleme

**Model seçimi:**
- Hız öncelikli: `gemini-1.5-flash` (maliyet düşük, yeterince iyi)
- Kalite öncelikli: `gemini-1.5-pro` (önemli haberler için)

**Çıktı gereksinimleri:**
- Maksimum **240 karakter** (link ve hashtag için yer bırak)
- Türkçe ve/veya İngilizce (hesap diline göre)
- CTA (Call-to-Action) içermeli: "Ne düşünüyorsunuz?", "Siz ne dersiniz?" gibi
- Emoji kullanımı: kategoriye göre 0-2 emoji (haber kategorisi = az emoji, teknoloji = daha fazla)

### 8.2 Ton Sistemi

Tek prompt yerine her kategori için **ayrı prompt template**:

| Kategori | Ton | Örnek Açılış |
|---|---|---|
| Ekonomi & Finans | Ciddi, bilgilendirici | "Dikkat çekici gelişme:" |
| Teknoloji | Meraklı, heyecanlı | "Yeni bir dönem başlıyor:" |
| Siyaset | Nötr, tarafsız | "Son dakika:" |
| Bilim | Keşifçi, ilham verici | "Bilim dünyasında:" |
| Spor | Enerjik, dinamik | "Sahadan son dakika:" |
| Genel | Dengeli | "Öne çıkan haber:" |

### 8.3 Thread Oluşturma (Uzun Haberler)
Özetlenemeyecek kadar kapsamlı haberler için (>500 kelime kaynak metin) otomatik thread modu:
- Tweet 1: Ana haber + merak uyandıran ilk cümle
- Tweet 2-4: Detaylar, bağlam, rakamlar
- Son tweet: Sonuç + link + kaynak

### 8.4 Prompt Güvenlik Önlemleri
- Çıktı her zaman karakter sayısı kontrolünden geçer
- Belirli içerikler (telefon no, e-posta, kişisel veri) regex ile temizlenir
- "Haber kaynağı: [site adı]" sonuna otomatik eklenir

---

## 9. Görsel İşleme Katmanı

### 9.1 Görsel Kaynak Hiyerarşisi (Telif Riski Yönetimi)

```
Öncelik 1: Open Graph görseli kullan (bazı siteler izin verir, robots.txt'e bak)
Öncelik 2: Unsplash API — haber konusuna uygun arama terimi ile ücretsiz görsel
Öncelik 3: Pexels API — alternatif ücretsiz görsel kaynağı
Öncelik 4: Şablon tabanlı görsel — Sharp ile metin + gradient arka plan + logo
Öncelik 5: Görselsiz gönder
```

> **Neden kaynak sitesinin görselini direkt kullanmıyoruz?**  
> Telif hukuku açısından "editoryal kullanım" savunması belirsiz. Özellikle ticari amaçlı hesaplarda telif şikayeti hesabın askıya alınmasına yol açabilir. Unsplash/Pexels API'leri tamamıyla ücretsiz ve ticari kullanıma açık.

### 9.2 Görsel Şablon (Sharp ile)
```
┌─────────────────────────────┐
│  [Gradient Arka Plan]       │
│                             │
│  [Niş Logo - sol üst]       │
│                             │
│  [Haber Başlığı - beyaz]    │
│  [Kaynak Adı - gri]         │
│                             │
│  [Alt Bar: Tarih + Saat]    │
└─────────────────────────────┘
Boyut: 1200x675 (Twitter card için optimal)
```

---

## 10. Yayın & Zamanlama Katmanı

### 10.1 Bot Tespit Koruma Önlemleri

**Random Jitter:**
```
Hedef saat: 14:00
Gerçek gönderim: 14:00 ± rastgele(1-12) dakika
```

**Günlük paylaşım dağılımı:**
```
Sabah   (07:00-09:00): 2-3 tweet — sabah okuyucu kitlesi
Öğle    (12:00-14:00): 2-3 tweet — öğle molası
Akşam   (18:00-20:00): 2-3 tweet — iş çıkışı
Gece    (21:00-23:00): 2-3 tweet — yoğun X kullanım saati
```

**İnsan Davranışı Simülasyonu:**
- Hafta sonları gönderi sayısı %30 azaltılır (insan gibi davranma)
- Bayram/özel günlerde farklı ton kullanılır
- Aynı anda 2+ tweet kesinlikle gönderilmez (min 30 dakika arayla)

### 10.2 X API Rate Limit Yönetimi

| Limit | Ücretsiz Katman | Temel Katman ($100/ay) |
|---|---|---|
| Tweet/ay | 1.500 | 50.000 |
| Read/ay | 10.000 | 500.000 |
| App/hesap | 1 | Çoklu |

**Öneri:** Başlangıç için **Temel Katman** gerekebilir (ayda 15 tweet/gün × 30 = 450 tweet, ücretsiz katman yeterli ancak read limiti dar).

**Rate limit guard:**
```typescript
// Gönderimden önce limit kontrolü
const remaining = await checkRateLimit();
if (remaining.tweets < 10) {
  logger.warn('Rate limit yaklaşıyor, gönderim yavaşlatılıyor');
  await delay(60 * 60 * 1000); // 1 saat bekle
}
```

**Exponential Backoff (429 hatası alındığında):**
```
İlk retry: 60 saniye bekle
İkinci retry: 120 saniye bekle
Üçüncü retry: 240 saniye bekle
4. retry'dan sonra: İşi kuyruğa geri al, alarm ver
```

### 10.3 Tweet Formatı

**Standart tweet yapısı:**
```
[AI Özeti - max 200 karakter]

[1-2 hashtag]

[Kaynak: Site Adı]
---
İlk yorum (otomatik): [Orijinal haber linki]
```

**Thread yapısı:**
```
Tweet 1/4: [Hook - merak uyandıran ilk cümle] 🧵
Tweet 2/4: [Ana detaylar]
Tweet 3/4: [Bağlam ve rakamlar]
Tweet 4/4: [Sonuç + kaynak linki]
```

---

## 11. Hibrit Onay Modeli (Telegram Bot)

### 11.1 Akış

```
Haber işlendi → Telegram'a bildirim gönderildi
     │
     ▼
Bot mesajı:
┌─────────────────────────────────┐
│ 📰 YENİ HABER                   │
│ Başlık: [...]                   │
│ Kaynak: [...]                   │
│ Skor: 78/100                    │
│                                 │
│ Taslak Tweet:                   │
│ "[AI özetinin tam metni]"       │
│                                 │
│ [✅ Onayla] [❌ Reddet] [✏️ Düzenle]│
└─────────────────────────────────┘
     │
     ├── Onayla → Kuyruğa ekle, zamanla
     ├── Reddet → Veritabanına "reddedildi" olarak işaretle
     └── Düzenle → Metin geri gönderilir, yeni metin beklenir
```

### 11.2 Toplu Onay
Sabah ilk girişte o güne ait bekleyen tüm haberler özet liste olarak gönderilir:
- `/queue` komutuyla bekleyen haberleri gör
- `/approve_all` ile hepsini onayla
- `/reject id` ile tekil reddet

### 11.3 Otomatik Moda Geçiş
Belirli bir süre (ör. 2 hafta) boyunca reddedilen haber oranı <%10 olursa:
- Sistem bildirim gönderir: "Otomatik moda geçmeye hazır görünüyorsunuz"
- Onay sonrası fully-automatic moda geçilir

---

## 12. Veritabanı Şeması

```sql
-- Haber kaynakları
CREATE TABLE sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  url         TEXT NOT NULL UNIQUE,
  rss_url     TEXT,
  scrape_url  TEXT,
  lang        TEXT DEFAULT 'tr',
  reliability INT DEFAULT 3,        -- 1-5 arası güvenilirlik puanı
  categories  TEXT[],               -- ['teknoloji', 'ekonomi']
  is_active   BOOLEAN DEFAULT true,
  websub_hub  TEXT,                 -- WebSub hub URL (destekliyorsa)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ham haberler (işlenmemiş)
CREATE TABLE raw_articles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    UUID REFERENCES sources(id),
  url          TEXT NOT NULL UNIQUE,
  url_hash     TEXT NOT NULL UNIQUE,  -- SHA-256(url)
  title        TEXT NOT NULL,
  summary      TEXT,
  full_text    TEXT,
  image_url    TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  lang         TEXT DEFAULT 'tr',
  categories   TEXT[]
);

-- İşlenmiş haberler (AI çıktısıyla)
CREATE TABLE processed_articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_article_id  UUID REFERENCES raw_articles(id) UNIQUE,
  score           DECIMAL(5,2),       -- 0-100 öncelik skoru
  tweet_text      TEXT NOT NULL,
  thread_tweets   JSONB,              -- Thread varsa tüm tweetler
  image_path      TEXT,               -- İşlenmiş görsel path
  image_source    TEXT,               -- 'og', 'unsplash', 'template'
  tone            TEXT,               -- 'serious', 'curious', 'energetic'
  status          TEXT DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'queued' | 'published' | 'failed'
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Yayınlanan tweetler
CREATE TABLE published_tweets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_id      UUID REFERENCES processed_articles(id),
  tweet_id          TEXT NOT NULL UNIQUE,   -- X'ten dönen tweet ID
  tweet_url         TEXT NOT NULL,
  reply_tweet_id    TEXT,                   -- Link yorumu ID (ilk reply)
  published_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Analytics (periyodik güncellenir)
  impressions       INT DEFAULT 0,
  likes             INT DEFAULT 0,
  retweets          INT DEFAULT 0,
  replies           INT DEFAULT 0,
  bookmarks         INT DEFAULT 0,
  profile_visits    INT DEFAULT 0,
  last_analytics_at TIMESTAMPTZ
);

-- Sistem logları ve hatalar
CREATE TABLE system_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level      TEXT NOT NULL,   -- 'info' | 'warn' | 'error'
  module     TEXT NOT NULL,   -- 'fetcher' | 'ai' | 'publisher' | vb.
  message    TEXT NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Günlük istatistikler
CREATE TABLE daily_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  articles_fetched   INT DEFAULT 0,
  articles_processed INT DEFAULT 0,
  articles_published INT DEFAULT 0,
  articles_rejected  INT DEFAULT 0,
  total_impressions  BIGINT DEFAULT 0,
  total_likes        INT DEFAULT 0,
  total_retweets     INT DEFAULT 0,
  api_calls_used     INT DEFAULT 0
);
```

---

## 13. Analytics & Geri Bildirim Döngüsü

### 13.1 Metrik Toplama
Her 6 saatte bir yayınlanan tweetlerin metrikleri X API'den çekilir:
- İzlenme (impressions), beğeni, retweet, yanıt, yer imi, profil ziyareti

### 13.2 Öğrenme Döngüsü

```
Metrikler toplanır (6 saatlik)
         │
         ▼
Hangi kategoriler / tonlar / saatler daha iyi?
         │
         ▼
Config güncellemesi önerisi üretilir
(ör: "Teknoloji haberleri akşam 21:00'de %40 daha fazla etkileşim alıyor")
         │
         ▼
Telegram'dan onay alınır veya otomatik uygulanır
         │
         ▼
Zamanlama & ton ağırlıkları güncellenir
```

### 13.3 Raporlama
Her Pazartesi sabahı haftalık özet Telegram'a gönderilir:
```
📊 HAFTALIK RAPOR
─────────────────
Yayınlanan tweet: 87
Toplam görüntülenme: 45.230
En çok etkileşim: [tweet başlığı] (1.2K beğeni)
En iyi kategori: Teknoloji (%34 etkileşim payı)
En iyi saat: 21:00-22:00
Hesap büyüme: +23 takipçi
─────────────────
X Revenue Sharing Hedefi:
▓▓▓░░░░░░░ 180K / 5M görüntülenme (%3.6)
```

---

## 14. Proje Klasör Yapısı

```
autosocial/
├── src/
│   ├── config/
│   │   ├── env.ts              # Zod ile env validation
│   │   ├── sources.ts          # Haber kaynakları listesi
│   │   └── keywords.ts         # Niş anahtar kelimeler & kara liste
│   │
│   ├── modules/
│   │   ├── fetcher/
│   │   │   ├── rss.ts          # RSS parser
│   │   │   ├── scraper.ts      # Cheerio scraper
│   │   │   ├── playwright.ts   # Son çare browser scraper
│   │   │   └── index.ts        # Orkestrasyyon
│   │   │
│   │   ├── processor/
│   │   │   ├── dedup.ts        # Duplicate tespiti
│   │   │   ├── filter.ts       # İçerik filtreleme & moderasyon
│   │   │   ├── scorer.ts       # Öncelik skoru hesaplama
│   │   │   ├── ai.ts           # Gemini API entegrasyonu
│   │   │   ├── image.ts        # Görsel işleme (Sharp)
│   │   │   └── index.ts
│   │   │
│   │   ├── approval/
│   │   │   ├── telegram.ts     # Telegram bot (Telegraf)
│   │   │   └── queue.ts        # Onay kuyruğu yönetimi
│   │   │
│   │   ├── publisher/
│   │   │   ├── twitter.ts      # twitter-api-v2 wrapper
│   │   │   ├── rateLimiter.ts  # Rate limit guard
│   │   │   ├── scheduler.ts    # Cron + jitter
│   │   │   └── index.ts
│   │   │
│   │   └── analytics/
│   │       ├── collector.ts    # Tweet metrik toplama
│   │       ├── reporter.ts     # Haftalık rapor üretimi
│   │       └── optimizer.ts    # Config önerileri
│   │
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema
│   │   ├── migrations/         # DB migration dosyaları
│   │   └── index.ts            # DB bağlantısı
│   │
│   ├── queues/
│   │   ├── worker.ts           # BullMQ worker
│   │   └── jobs.ts             # Job tanımları
│   │
│   └── main.ts                 # Uygulama giriş noktası
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── docker-compose.yml          # Lokal geliştirme (Postgres + Redis)
├── railway.toml                # Railway deploy konfigürasyonu
├── .env.example                # Gerekli environment variable'lar
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 15. Environment Variables

```env
# Uygulama
NODE_ENV=production
LOG_LEVEL=info
APP_MODE=hybrid                    # hybrid | automatic

# Veritabanı
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# X (Twitter) API
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_BEARER_TOKEN=

# Gemini AI
GEMINI_API_KEY=

# Görsel API'leri
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Sistem Ayarları
MAX_TWEETS_PER_DAY=15
MIN_TWEETS_PER_DAY=8
MIN_SCORE_THRESHOLD=60
FETCH_INTERVAL_MINUTES=15
ANALYTICS_FETCH_INTERVAL_HOURS=6
```

---

## 16. Geliştirme Fazları

### Faz 1 — Çekirdek (1-2 Hafta)
- [ ] Proje iskeleti, TypeScript config, DB şeması, Docker Compose
- [ ] RSS çekme modülü (5-10 kaynak ile test)
- [ ] Basit deduplication (URL hash)
- [ ] Gemini AI özetleme (tek ton ile başla)
- [ ] Temel X API entegrasyonu (manuel tweet at testi)

### Faz 2 — Otomasyon (2-3 Hafta)
- [ ] Skorlama algoritması
- [ ] Tam deduplication (semantic similarity)
- [ ] İçerik moderasyon filtreleri
- [ ] Cron zamanlayıcı + random jitter
- [ ] BullMQ kuyruk sistemi
- [ ] Rate limit guard + exponential backoff

### Faz 3 — Hibrit Mod (1 Hafta)
- [ ] Telegram bot entegrasyonu (onay akışı)
- [ ] Görsel işleme (Sharp template)
- [ ] Unsplash/Pexels API entegrasyonu
- [ ] Link-ilk-yoruma mekanizması

### Faz 4 — Analytics & Optimizasyon (1-2 Hafta)
- [ ] Tweet metrik toplama
- [ ] Haftalık Telegram raporu
- [ ] Ton sistemi (kategori bazlı prompt'lar)
- [ ] Thread oluşturma

### Faz 5 — Production & İzleme
- [ ] Railway.app deploy
- [ ] GitHub Actions CI/CD pipeline
- [ ] Alarm sistemi (X API erişimi kesilirse, hata oranı yüksekse)
- [ ] Playwright scraper (RSS olmayan kaynaklar için)

---

## 17. Riskler & Azaltma Stratejileri

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| X hesabının shadowban'a uğraması | Orta | Yüksek | Random jitter, insan davranışı simülasyonu, hibrit mod |
| X API policy değişikliği | Orta | Yüksek | Platform-agnostik tasarım, alternatif platforma geçiş planı |
| Telif hakkı şikayeti (görsel) | Düşük | Orta | Görsel kaynak hiyerarşisi (Unsplash → template) |
| Gemini API maliyet artışı | Düşük | Orta | Model seçimi (Flash vs Pro), fallback şablonlara geçiş |
| Haber kaynağı scraping engeli | Yüksek | Düşük | RSS önceliği, çoklu kaynak, user-agent rotasyonu |
| 5M görüntülenme hedefine ulaşamama | Yüksek | Düşük | Alternatif gelir modelleri (sponsorlu içerik, web trafik) |

---

## 18. Gelir Modeli & Beklentiler (Gerçekçi)

### Birincil Hedef: X Ads Revenue Sharing
| Gereksinim | Durum | Tahmini Süre |
|---|---|---|
| X Premium aboneliği | ✅ Onaylandı | — |
| 500 organik takipçi | ✅ Mevcut (406 → 500) | ~1-2 ay |
| 5M organik görüntülenme/3 ay | ⬜ Hedef | **Belirsiz (6-24 ay)** |
| Stripe hesabı | ⬜ Açılacak | 1 gün |

> **Gerçekçi Not:** 5 milyon organik görüntülenme eşiği zorlu bir hedeftir. Viral içerik veya hızlı hesap büyümesi olmaksızın aylar alabilir. Bu modeli **uzun vadeli** olarak konumlandırmak ve aşağıdaki alternatifleri paralelde geliştirmek önerilir.

### İkincil Gelir Modelleri (Daha Erişilebilir)
1. **Sponsorlu gönderi:** 1.000+ takipçi ve niş kitlesine ulaşınca markalardan teklif gelebilir
2. **Kendi web sitesine trafik yönlendirme → Google AdSense:** X hesabı köprü olarak kullanılır
3. **Bülten (newsletter) aboneliği:** X'ten Substack/Beehiiv'e yönlendirme
4. **Affiliate link:** Haber kategorisine uygun ürün/hizmet yönlendirmesi

### Tahmini Maliyet Yapısı (Aylık)

| Kalem | Tahmini Maliyet |
|---|---|
| X Premium | ~$8/ay |
| Railway.app hosting | $5-10/ay (Starter) |
| Gemini API (Flash) | ~$2-5/ay (15 tweet/gün) |
| Unsplash API | Ücretsiz |
| Pexels API | Ücretsiz |
| PostgreSQL (Railway) | Dahil |
| Redis (Railway) | Dahil |
| **Toplam** | **~$15-23/ay** |

---

## 19. Başarı Kriterleri (KPI)

| Metrik | Ay 1 Hedef | Ay 3 Hedef | Ay 12 Hedef |
|---|---|---|---|
| Günlük tweet sayısı | 8-10 | 12-15 | 12-15 |
| Aylık görüntülenme | 50K | 300K | 1.5M+ |
| Takipçi sayısı | 450 | 700 | 2.000+ |
| Ortalama etkileşim oranı | %0.5 | %1 | %2+ |
| Sistem uptime | %95 | %99 | %99.5 |
| Reddedilen haber oranı | <%30 | <%15 | <%10 |

---

*AutoSocial PRD v1.0 — Tüm haklar saklıdır.*
