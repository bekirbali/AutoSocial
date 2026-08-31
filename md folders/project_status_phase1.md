# AutoSocial Projesi: Güncel Durum Özeti

Son güncelleme: 30 Ağustos 2026

---

## 1. Proje Altyapısı ve Kurulum (✅ Tamamlandı)

- **Teknoloji Yığını:** Node.js 20+ / TypeScript, paket yöneticisi `pnpm`
- **Docker Entegrasyonu:** `docker-compose.yml` ile PostgreSQL 16 (port 5433) + Redis 7 ayakta ve sağlıklı (healthy)
- **Çevresel Değişkenler:** `.env` dosyası hazır; X API, Telegram, Gemini API key'leri ve `DATABASE_URL` / `REDIS_URL` tanımlı. Zod ile her başlatmada doğrulanıyor.

## 2. Veritabanı ve Şema (✅ Tamamlandı)

Drizzle ORM ile tüm tablolar tanımlandı ve `pnpm db:migrate` ile PostgreSQL'e uygulandı.

| Tablo | Açıklama |
|---|---|
| `sources` | RSS kaynakları (13 kaynak, EN + TR) |
| `raw_articles` | RSS'ten çekilen ham haberler |
| `processed_articles` | AI ile işlenmiş, tweet metni + görsel yolu olan haberler |
| `published_tweets` | X'te yayınlanan tweetler + engagement metrikleri |
| `daily_stats` | Günlük özet istatistikler |
| `system_logs` | Sistem logları |

## 3. Kod Modülleri ve İş Mantığı (✅ Tamamlandı — Faz 1)

### `src/modules/fetcher/`
- 13 kaynak (AnandTech, Tom's Hardware, TechPowerUp, Videocardz, Donanım Haber vb.) aynı anda max 5 paralel istek ile çekiliyor
- Ardışık 5 hata veren kaynak otomatik devre dışı bırakılıyor

### `src/modules/processor/`
| Dosya | İşlev | Durum |
|---|---|---|
| `dedup.ts` | 2 katmanlı duplicate kontrolü (Redis O(1) + DB fallback) + benzer başlık tespiti | ✅ |
| `filter.ts` | Dil, yaş (48 saat), keyword filtreleme | ✅ |
| `scorer.ts` | 4 bileşenli skor: freshness %40, keyword %30, kaynak güvenilirliği %20, başlık kalitesi %10 | ✅ |
| `ai.ts` | Gemini 1.5 Flash ile kategori bazlı Türkçe tweet üretimi (JSON çıktı) | ✅ |
| `image.ts` | Sharp ile SVG→WebP gradient kart üretimi (~50ms), 13 kategori rengi | ✅ |

### `src/modules/publisher/`
| Dosya | İşlev | Durum |
|---|---|---|
| `twitter.ts` | OAuth 1.0a ile tweet + görsel yükleme + ilk yoruma kaynak linki | ✅ |
| `rateLimiter.ts` | 429 hatası için exponential backoff (60s→120s→240s) | ✅ |
| `scheduler.ts` | Günlük plan üretici: 4 zaman dilimi, ±12dk jitter, hafta sonu %30 azaltma | ✅ |

### `src/config/`
- `env.ts` — Zod şeması ile env doğrulama
- `sources.ts` — 13 kaynak konfigürasyonu (EN + TR)
- `keywords.ts` — Niş anahtar kelimeler + kategori renkleri (13 kategori)

### `src/main.ts`
Şu anki çalışma modu: **tek çalışma (one-shot)**
`fetch → dedup → filter → score → AI → image → publish → exit()`

## 4. Test Scriptleri (✅ Mevcut)

`scripts/` altında izole test dosyaları:
- `test-fetch.ts` → RSS fetcher testi
- `test-ai.ts` → Gemini tweet üretimi testi
- `test-image.ts` → Sharp görsel üretimi testi
- `test-tweet.ts` → X API bağlantı testi

TypeScript derleme: **sıfır hata** (`pnpm typecheck`)

---

## Faz 2'de Yapılacaklar (Sıradaki Aşama)

> Amaç: Sistemi "bir kez çalış, kapat" yapısından **7/24 çalışan daemon**'a dönüştürmek.

1. **BullMQ Worker Mimarisi**
   - `fetch-worker` → RSS çekme işleri
   - `process-worker` → Makale işleme işleri
   - `publish-worker` → Delayed tweet yayın işleri
   - `analytics-worker` → Metrik güncelleme işleri

2. **Cron Scheduler (BullMQ `repeat`)**
   - Her `FETCH_INTERVAL_MINUTES` dakikada RSS fetch
   - Her sabah 06:30'da günlük yayın planı üretimi
   - Her `ANALYTICS_FETCH_INTERVAL_HOURS` saatte metrik güncelleme

3. **`main.ts` Refactor**
   - Worker'ları başlat → Cron'ları kayıt et → `SIGTERM` bekle (kapanmaz)

4. **Analytics Modülü**
   - `published_tweets` tablosundaki engagement metriklerini X API'dan güncelleme
   - `daily_stats` tablosuna günlük özet yazma

## Faz 3'e Bırakılanlar (Sonraki Aşama)

- Telegram bot onay akışı (hibrit mod)
- Thread tweet desteği

## Faz 4'e Bırakılanlar

- Haftalık rapor
- Ton sistemi geliştirmesi
- Analytics dashboard

## Faz 5'e Bırakılanlar

- Railway.app deploy
- CI/CD pipeline
- Alarm sistemi
