# AutoSocial — Faz 1 Implementation Planı

Faz 1 hedefi: Projenin çalışan çekirdeğini kurmak.
RSS'ten haber çek → Gemini ile özetle → X'e tweet at (test modunda).

---

## Önemli Kararlar

> [!IMPORTANT]
> **Görsel strateji değişikliği:** PRD'de Unsplash/Pexels var ama `autosocial-context.md` kuralına göre bu API'ler **çıkarıldı**. Faz 1'de yalnızca Sharp template kullanılacak.

> [!IMPORTANT]
> **DATABASE_URL ve REDIS_URL eksik.** Faz 1 sırasında **Docker Compose** ile local Postgres + Redis ayağa kaldırılacak. Railway deploy Faz 5'te yapılacak.

> [!NOTE]
> **Telegram bot Faz 3'te.** Faz 1'de onay akışı yok; işlenen haberler doğrudan "approved" olarak işaretlenir ve manuel test tweetleri atılır.

---

## Açık Sorular

> [!IMPORTANT]
> **Haber dili:** Sistemi Türkçe kaynaklarla mı, İngilizce kaynaklarla mı, yoksa ikisiyle birden mi başlatayım? (Tweet dili buna bağlı)

> [!IMPORTANT]
> **Niş seçimi:** Hangi kategoride başlamak istiyorsunuz?
> - Teknoloji & Yapay Zeka
> - Ekonomi & Finans
> - Genel haber (karma)
> Başlangıç nişi kaynak listesini ve Gemini prompt'larını etkiliyor.

> [!NOTE]
> **Minimum skor eşiği:** Context kuralında 70/100 diyor, PRD'de 60/100 yazıyor. Hangisini uygulayayım? (Öneri: context kuralına uyarak **70** kullanalım)

---

## Proposed Changes

### 1. Proje İskeleti

#### [NEW] `package.json`
pnpm ile Node.js 20 + TypeScript projesi. Tüm bağımlılıklar:
- `typescript`, `tsx`, `@types/node`
- `drizzle-orm`, `drizzle-kit`, `postgres`
- `ioredis`, `bullmq`
- `rss-parser`, `cheerio`, `axios`
- `@google/generative-ai`
- `sharp`
- `twitter-api-v2`
- `telegraf` (Faz 3'e hazırlık amaçlı kurulur)
- `pino`, `pino-pretty`
- `dotenv`, `zod`

#### [NEW] `tsconfig.json`
`moduleResolution: bundler`, `target: ES2022`, `strict: true`

#### [NEW] `docker-compose.yml`
PostgreSQL 16 + Redis 7 (local geliştirme için)

#### [NEW] `.env.example`
Tüm gerekli env variable'ların şablonu

#### [NEW] `drizzle.config.ts`
Drizzle Kit migration config

---

### 2. Config Katmanı (`src/config/`)

#### [NEW] `src/config/env.ts`
Zod ile tüm env variable'ları parse ve validate eder. Hatalı config'de uygulama başlamaz.

```typescript
// Örnek
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  X_CONSUMER_KEY: z.string().min(1),
  // ...
  APP_MODE: z.enum(['hybrid', 'automatic']).default('hybrid'),
  MAX_TWEETS_PER_DAY: z.coerce.number().default(15),
  MIN_SCORE_THRESHOLD: z.coerce.number().default(70),
});
```

#### [NEW] `src/config/sources.ts`
Başlangıç RSS kaynak listesi (5-10 kaynak, seçilen nişe göre):

**Teknoloji nişi için örnek:**
- TechCrunch RSS (`https://techcrunch.com/feed/`)
- The Verge (`https://www.theverge.com/rss/index.xml`)
- Hacker News (`https://hnrss.org/frontpage`)
- Webtekno (`https://www.webtekno.com/rss.xml`)
- Shiftdelete (`https://shiftdelete.net/feed`)

#### [NEW] `src/config/keywords.ts`
Niş anahtar kelimeleri (skor hesabında kullanılır) ve kara liste.

---

### 3. Veritabanı Katmanı (`src/db/`)

#### [NEW] `src/db/schema.ts`
PRD'deki SQL şemasının Drizzle ORM karşılığı:
- `sources` tablosu
- `raw_articles` tablosu
- `processed_articles` tablosu
- `published_tweets` tablosu
- `system_logs` tablosu
- `daily_stats` tablosu

#### [NEW] `src/db/index.ts`
`drizzle(pool)` bağlantısı, connection pool konfigürasyonu

#### [NEW] `src/db/migrations/`
`drizzle-kit generate` ile otomatik oluşturulacak

---

### 4. RSS Fetcher Modülü (`src/modules/fetcher/`)

#### [NEW] `src/modules/fetcher/rss.ts`
- `rss-parser` ile RSS feed çekme
- Her kaynak için timeout (10s) + retry (3x, exponential backoff)
- `RawArticle` interface'ine dönüştürme
- Başarısız kaynak takibi (5 ardışık başarısızlıkta `is_active=false`)

#### [NEW] `src/modules/fetcher/index.ts`
- Tüm aktif kaynakları sırayla çek
- `src/modules/processor/index.ts`'e ilet
- Her 15 dakikada bir tetiklenecek (Faz 2'de cron'a taşınır, Faz 1'de manuel)

---

### 5. Processor Modülü (`src/modules/processor/`)

#### [NEW] `src/modules/processor/dedup.ts`
- SHA-256(url) → Redis'te `SET NX` ile kontrol (O(1))
- 24 saatlik TTL
- Aynı gün içinde benzer başlık tespiti (Levenshtein distance, eşik: %85)

#### [NEW] `src/modules/processor/filter.ts`
- Dil filtresi
- Minimum başlık uzunluğu (100 karakter değil, 10 kelime)
- Domain kara listesi kontrolü
- Anahtar kelime kara listesi taraması

#### [NEW] `src/modules/processor/scorer.ts`
- Freshness skoru (yayın zamanına göre lineer azalma)
- Keyword eşleşme skoru
- Kaynak güvenilirlik skoru (DB'den)
- Başlık kalite skoru
- Ağırlıklı toplam → MIN_SCORE_THRESHOLD (70) altındaysa atla

#### [NEW] `src/modules/processor/ai.ts`
Gemini 1.5 Flash ile özetleme:
```typescript
// Kategori bazlı prompt template'leri
// Çıktı: max 200 karakter tweet metni
// + 1-2 hashtag önerisi
// + ton seçimi
```

#### [NEW] `src/modules/processor/image.ts`
Sharp ile 1200x675 template görsel üretimi:
- Kategori rengine göre gradient arka plan
- Başlık metni (beyaz, bold)
- Kaynak adı (gri, küçük)
- Tarih bilgisi (alt bar)

#### [NEW] `src/modules/processor/index.ts`
Pipeline orkestrasyonu: `dedup → filter → score → ai → image → db'ye kaydet`

---

### 6. Publisher Modülü (`src/modules/publisher/`)

#### [NEW] `src/modules/publisher/twitter.ts`
`twitter-api-v2` wrapper:
- `postTweet(text, imageBuffer?)` — tweet at
- `postReply(tweetId, text)` — link'i ilk yoruma ekle
- `checkRateLimit()` — kalan limit kontrolü

#### [NEW] `src/modules/publisher/rateLimiter.ts`
- 429 hatası → exponential backoff (60s → 120s → 240s)
- Kalan tweet < 10 → 1 saat bekle, Telegram'a uyar (Faz 3'e kadar log'a yaz)

#### [NEW] `src/modules/publisher/scheduler.ts`
Faz 1'de basit versiyon:
- Onaylanmış haberleri DB'den çek
- Random jitter (±1-12 dakika) ile gönder
- Gönderim arasında min 30 dakika bekle

#### [NEW] `src/modules/publisher/index.ts`
Publisher pipeline orkestrasyonu

---

### 7. Logger (`src/lib/logger.ts`)

#### [NEW] `src/lib/logger.ts`
Pino ile yapılandırılmış JSON logger:
- Dev'de `pino-pretty` ile okunabilir çıktı
- Her log kaydı aynı zamanda `system_logs` tablosuna yazılır (error/warn için)

---

### 8. Ana Giriş Noktası (`src/main.ts`)

#### [NEW] `src/main.ts`
Faz 1'de basit bir **pipeline runner**:
```
1. DB + Redis bağlantılarını kur
2. Aktif kaynakları RSS'ten çek
3. Her makaleyi process et (dedup → filter → score → ai → image)
4. Test modunda: DB'ye kaydet, tweet atmadan dur
5. Prod modunda: Scheduler'a ver, tweet at
```

---

### 9. Test Betikleri (`scripts/`)

#### [NEW] `scripts/test-fetch.ts`
Tek bir RSS kaynağını çekip konsola yazdır (bağlantı testi)

#### [NEW] `scripts/test-ai.ts`
Örnek bir başlığı Gemini'ye gönder, tweet metni döndür

#### [NEW] `scripts/test-tweet.ts`
Test tweet at (X API bağlantı doğrulama)

#### [NEW] `scripts/test-image.ts`
Örnek Sharp görsel üret, `output/test.png` olarak kaydet

---

## Verification Plan

### Automated Tests
```bash
# Docker servislerini başlat
docker-compose up -d

# DB migration çalıştır
pnpm drizzle-kit migrate

# TypeScript derleme hatası yok mu?
pnpm tsc --noEmit

# RSS çekme testi
pnpm tsx scripts/test-fetch.ts

# Gemini AI testi
pnpm tsx scripts/test-ai.ts

# Sharp görsel testi
pnpm tsx scripts/test-image.ts

# X API bağlantı testi (TEST_MODE=true)
pnpm tsx scripts/test-tweet.ts
```

### Manuel Doğrulama
1. DB'de `raw_articles` tablosunda veri göründü mü?
2. `processed_articles`'da tweet metni ve görsel yolu oluştu mu?
3. Test tweet X hesabında göründü mü?

---

## Oluşturulacak Dosya Özeti

```
AutoSocial/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   ├── sources.ts
│   │   └── keywords.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── migrations/  (drizzle-kit ile otomatik)
│   ├── modules/
│   │   ├── fetcher/
│   │   │   ├── rss.ts
│   │   │   └── index.ts
│   │   ├── processor/
│   │   │   ├── dedup.ts
│   │   │   ├── filter.ts
│   │   │   ├── scorer.ts
│   │   │   ├── ai.ts
│   │   │   ├── image.ts
│   │   │   └── index.ts
│   │   └── publisher/
│   │       ├── twitter.ts
│   │       ├── rateLimiter.ts
│   │       ├── scheduler.ts
│   │       └── index.ts
│   ├── lib/
│   │   └── logger.ts
│   └── main.ts
├── scripts/
│   ├── test-fetch.ts
│   ├── test-ai.ts
│   ├── test-tweet.ts
│   └── test-image.ts
├── docker-compose.yml
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

**Tahmini süre:** 2-3 saat (aktif kodlama)
