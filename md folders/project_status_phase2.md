# AutoSocial — Proje Detaylı Özeti (Faz 1 + Faz 2 Tamamlandı)

Son güncelleme: 30 Ağustos 2026

---

## 🎯 Proje Nedir?

**AutoSocial**, haber kaynaklarından otomatik içerik toplayıp yapay zeka ile Türkçe'ye çeviren, görsel üreten ve X (Twitter) hesabına belirli saatlerde otomatik yayın yapan bir otomasyon sistemidir.

**Hedef kitle:** PC donanım meraklıları (işlemci, ekran kartı, bellek, oyun vb.)
**Yayın dili:** Türkçe (haberler EN veya TR olabilir, tweet her zaman TR)
**Hesap durumu:** 406 takipçili X hesabı, sıfırdan büyüme hedefi

---

## 🏗️ Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Runtime | Node.js 20+ / TypeScript |
| Paket Yöneticisi | pnpm |
| Veritabanı | PostgreSQL 16 (Drizzle ORM) |
| Cache / Queue | Redis 7 + BullMQ |
| Yapay Zeka | Gemini 1.5 Flash (Google AI) |
| Görsel Üretimi | Sharp (SVG → WebP) |
| X API İstemcisi | twitter-api-v2 |
| Loglama | Pino + pino-pretty |
| Ortam Doğrulama | Zod |
| Altyapı (local) | Docker Desktop (PostgreSQL + Redis) |
| Altyapı (prod) | Railway.app (Faz 5'te) |

---

## 📁 Proje Yapısı

```
AutoSocial/
├── src/
│   ├── main.ts                        ← Ana giriş — daemon modu
│   ├── config/
│   │   ├── env.ts                     ← Zod ile env doğrulama
│   │   ├── sources.ts                 ← 13 RSS kaynağı konfigürasyonu
│   │   └── keywords.ts                ← Niş anahtar kelimeler + kategori renkleri
│   ├── db/
│   │   ├── schema.ts                  ← 6 tablo tanımı (Drizzle ORM)
│   │   ├── index.ts                   ← DB bağlantısı
│   │   └── migrations/                ← Uygulanan migration dosyaları
│   ├── lib/
│   │   ├── logger.ts                  ← Pino logger fabrikası
│   │   ├── redis.ts                   ← Redis bağlantısı + health check
│   │   └── queue.ts                   ← BullMQ queue tanımları (4 kuyruk)
│   ├── modules/
│   │   ├── fetcher/
│   │   │   ├── index.ts               ← Paralel RSS çekme (max 5 eşzamanlı)
│   │   │   └── rss.ts                 ← RSS parse + FetchedItem tipi
│   │   ├── processor/
│   │   │   ├── index.ts               ← Ana pipeline (dedup→filter→score→AI→image→DB)
│   │   │   ├── dedup.ts               ← 2 katmanlı duplicate kontrolü (Redis + DB)
│   │   │   ├── filter.ts              ← Dil, yaş, keyword filtreleme
│   │   │   ├── scorer.ts              ← 4 bileşenli öncelik skorlaması
│   │   │   ├── ai.ts                  ← Gemini 1.5 Flash tweet üretimi
│   │   │   └── image.ts               ← Sharp ile SVG→WebP kart üretimi
│   │   ├── publisher/
│   │   │   ├── index.ts               ← publishNext() (artık worker'dan çağrılıyor)
│   │   │   ├── twitter.ts             ← X API OAuth + tweet/reply gönderimi
│   │   │   ├── rateLimiter.ts         ← 429 exponential backoff
│   │   │   └── scheduler.ts           ← Günlük plan üretici + slot hesaplama
│   │   └── analytics/
│   │       ├── index.ts               ← X API metrik güncelleme
│   │       └── dailyStats.ts          ← In-memory counter + DB flush
│   ├── workers/
│   │   ├── fetchWorker.ts             ← RSS çekme worker'ı
│   │   ├── processWorker.ts           ← Makale işleme worker'ı
│   │   ├── publishWorker.ts           ← Delayed tweet yayın worker'ı
│   │   └── analyticsWorker.ts         ← Metrik güncelleme worker'ı
│   └── scheduler/
│       └── cron.ts                    ← BullMQ repeat cron'lar
├── scripts/
│   ├── test-fetch.ts                  ← RSS fetcher testi
│   ├── test-ai.ts                     ← Gemini testi
│   ├── test-tweet.ts                  ← X API bağlantı testi
│   └── test-image.ts                  ← Sharp görsel testi
├── docker-compose.yml                 ← PostgreSQL 16 + Redis 7
├── drizzle.config.ts
└── .env                               ← API key'ler (git'e girmez)
```

---

## 🗄️ Veritabanı Şeması

| Tablo | Açıklama | Önemli Kolonlar |
|---|---|---|
| `sources` | RSS kaynakları | name, rssUrl, reliability(1-5), consecutiveFailures |
| `raw_articles` | Ham haberler | url, urlHash, title, publishedAt |
| `processed_articles` | AI çıktısı | tweetText, hashtags, imagePath, score, status |
| `published_tweets` | Yayınlanan | tweetId, tweetUrl, likes, retweets, impressions |
| `daily_stats` | Günlük özet | articlesFetched/Processed/Published/Rejected |
| `system_logs` | Sistem logları | level, module, message |

`processed_articles.status` geçiş diyagramı:
```
pending → approved → queued → published
                  ↘ rejected
                           ↘ failed
```

---

## ⚙️ Sistem Nasıl Çalışıyor? (Faz 2 — Daemon Modu)

```
pnpm dev
    │
    ├─ DB + Redis bağlantı kontrolü
    ├─ 13 RSS kaynağını DB'ye seed et
    ├─ 4 BullMQ Worker başlat
    ├─ 3 Cron Job kayıt et
    ├─ Bootstrap: bekleyen makaleleri zamanla
    └─ 🟢 BEKLE (SIGTERM gelene kadar kapanmaz)

Cron Tetiklemeleri:
┌──────────────────────────────────────────┐
│ Her 15 dakika → fetch-queue'ya job ekle  │
│ Her sabah 06:30 → günlük plan yenile     │
│ Her 6 saatte → analytics güncelle        │
└──────────────────────────────────────────┘

fetch-queue → [fetchWorker]
                  │  RSS çek (13 kaynak, 5 paralel)
                  │  Hızlı dedup + filtre ön kontrolü
                  └→ process-queue'ya job ekle (2sn aralık)

process-queue → [processWorker] (concurrency=1)
                    │  isDuplicate() Redis+DB
                    │  filterArticle() dil/yaş/keyword
                    │  scoreArticle() freshness+keyword+reliability+quality
                    │  generateTweet() Gemini 1.5 Flash → Türkçe tweet
                    │  generateNewsCard() Sharp → WebP görsel
                    │  DB'ye kaydet (status: approved)
                    └→ publish-queue'ya DELAYED job ekle

publish-queue → [publishWorker] (delayed — günlük plana göre)
                    │  Günlük limit kontrolü
                    │  postTweet() görsel ile
                    │  postReply() kaynak linki (1. yorum)
                    └→ DB güncelle (status: published)

analytics-queue → [analyticsWorker]
                    │  X API'dan metrikler (likes, retweets vb.)
                    └→ daily_stats DB'ye flush
```

---

## 📰 Haber Kaynakları (13 Kaynak)

| Kaynak | Dil | Güvenilirlik |
|---|---|---|
| AnandTech | EN | ⭐⭐⭐⭐⭐ |
| Tom's Hardware | EN | ⭐⭐⭐⭐⭐ |
| Donanım Haber | TR | ⭐⭐⭐⭐⭐ |
| TechPowerUp | EN | ⭐⭐⭐⭐ |
| HardwareLuxx | EN | ⭐⭐⭐⭐ |
| The Verge | EN | ⭐⭐⭐⭐ |
| TechRadar | EN | ⭐⭐⭐⭐ |
| PCMag | EN | ⭐⭐⭐⭐ |
| Videocardz | EN | ⭐⭐⭐⭐ |
| Chip Online TR | TR | ⭐⭐⭐⭐ |
| Overclock3D | EN | ⭐⭐⭐ |
| ShiftDelete.net | TR | ⭐⭐⭐ |
| Webtekno | TR | ⭐⭐⭐ |

---

## 🏆 Öncelik Skoru (0–100)

Her haber aşağıdaki formüle göre puanlanır. **Eşik altı (varsayılan 70) haberler atlanır:**

| Bileşen | Ağırlık | Açıklama |
|---|---|---|
| Freshness | %40 | 0 dk=100, 24 saat=0 puan (lineer) |
| Keyword eşleşmesi | %30 | PC nişi anahtar kelimeler, başlıkta varsa +20 bonus |
| Kaynak güvenilirliği | %20 | 1 yıldız=20p, 5 yıldız=100p |
| Başlık kalitesi | %10 | Soru işareti, sayı, aksiyon kelimeleri |

---

## 🖼️ Görsel Üretimi (Sharp Template)

Her tweet için ~50ms'de otomatik üretilir. **Unsplash/Pexels kullanılmıyor** (ToS).

- **Boyut:** 1200×675 px (Twitter card optimum)
- **Format:** WebP (quality 85)
- **Tasarım:** Kategori rengine göre gradient arka plan + başlık metni + kaynak + tarih etiketi
- **13 kategori:** İşlemci (mavi), Ekran Kartı (mor), Bellek (yeşil), Oyun (kırmızı) vb.

---

## 📅 Yayın Stratejisi

| Özellik | Değer |
|---|---|
| Günlük tweet (hafta içi) | 8–15 |
| Günlük tweet (hafta sonu) | 5–10 (%30 azaltma) |
| Yayın dilimleri | Sabah 07-09, Öğle 12-14, Akşam 18-20, Gece 21-23 |
| Jitter | ±12 dakika rastgele sapma (bot tespitine karşı) |
| Min aralık | Tweet'ler arası minimum 30 dakika |
| Kaynak linki | İlk yorum olarak (X algoritması dış link tweetleri bastırıyor) |

---

## 🔑 API Durumu

| API | Durum | Not |
|---|---|---|
| Gemini API | ✅ Aktif | Free tier — günde ~1500 istek, bizim kullanım << bu limit |
| X API (OAuth 1.0a) | ✅ Aktif | Tweet + medya yükleme için |
| X Bearer Token | ✅ Aktif | Read-only, analytics için |
| Telegram Bot | ✅ Token var | Faz 3'te aktif edilecek |
| DATABASE_URL | ✅ Docker'da | Railway'de prod ortamı Faz 5'te |
| REDIS_URL | ✅ Docker'da | Railway'de prod ortamı Faz 5'te |

---

## ✅ Şu An Sistem Neler Yapabiliyor?

1. **Her 15 dakikada bir** 13 kaynaktan RSS çekiyor
2. Her haberi **duplicate kontrolünden** geçiriyor (Redis O(1) + DB fallback)
3. **Dil, yaş (48 saat), keyword** filtrelemesi yapıyor
4. **0–100 arası** öncelik skoru hesaplıyor; eşik altını (70) eliyor
5. Geçen haberler için Gemini 1.5 Flash ile **Türkçe tweet** üretiyor (kategori bazlı prompt)
6. Her tweet için **1200×675 WebP görsel kartı** üretiyor (~50ms)
7. Tüm veriyi **PostgreSQL'e** kaydediyor
8. Günlük plana göre **doğru saatte** tweet atıyor (jitter + min interval ile)
9. Tweet'in **ilk yorumuna kaynak linki** ekliyor
10. **Exponential backoff** ile X API 429 hatalarını yönetiyor
11. **Graceful shutdown** — CTRL+C basınca tüm worker'lar düzgünce kapanıyor
12. Günlük istatistikleri (`daily_stats`) periyodik olarak DB'ye yazıyor
13. **7/24 çalışabilen** — kapanmayan daemon mimarisi

---

## ❌ Henüz Yapılmayanlar

| Özellik | Faz | Açıklama |
|---|---|---|
| Telegram onay akışı | **Faz 3** | Hibrit mod — tweet öncesi Telegram'dan onay |
| Thread tweet | Faz 4 | Uzun haberler için thread zinciri |
| Haftalık rapor | Faz 4 | Telegram'a haftalık özet |
| Ton sistemi | Faz 4 | Breaking/analytical/deals modları |
| Gerçek analytics | Faz 4+ | X Premium sonrası engagement metrikleri |
| Railway deploy | **Faz 5** | Üretim ortamı, CI/CD |
| Alarm sistemi | Faz 5 | Hata durumunda Telegram bildirimi |

---

## 🚀 Sistemi Başlatma

### Ön koşullar
1. Docker Desktop açık olmalı
2. `.env` dosyasında tüm API key'ler dolu olmalı

### Komutlar

```bash
# Container'ları başlat (ilk kez veya durduktan sonra)
docker-compose up -d

# Geliştirme modu (hot-reload, renkli loglar)
pnpm dev

# Sadece tip kontrolü
pnpm typecheck

# DB migration (şema değişikliğinde)
pnpm db:generate && pnpm db:migrate

# Drizzle Studio (DB görsel arayüzü)
pnpm db:studio

# İzole testler
pnpm test:fetch    # RSS fetcher testi
pnpm test:ai       # Gemini testi
pnpm test:tweet    # X API bağlantı testi
pnpm test:image    # Sharp görsel testi
```

### Başarılı başlatma logları
```
✅ DB + Redis bağlantıları başarılı
✅ Fetch worker başlatıldı
✅ Process worker başlatıldı
✅ Publish worker başlatıldı
✅ Analytics worker başlatıldı
✅ RSS fetch cron kaydedildi → */15 dakika
✅ Günlük plan cron kaydedildi → her sabah 06:30
✅ Analytics cron kaydedildi → her 6 saatte
🟢 AutoSocial çalışıyor — Durdurmak için CTRL+C
```

---

## 📊 Faz Durumu

```
Faz 1 — Proje iskeleti + RSS + AI + X API    ✅ TAMAMLANDI
Faz 2 — BullMQ + Cron + Analytics + Daemon   ✅ TAMAMLANDI
─────────────────────────────────────────────────────────
Faz 3 — Telegram bot onay akışı              ⏳ SIRADA
Faz 4 — Thread + Rapor + Ton sistemi         ⏳ BEKLEMEDE
Faz 5 — Railway deploy + CI/CD + Alarm       ⏳ BEKLEMEDE
```

---

## 🔮 Faz 3'te Ne Olacak?

Telegram bot entegrasyonu ile **hibrit onay modu** aktif olacak:

1. Sistem bir haber işlediğinde, tweet atmadan önce Telegram'a bildirim gönderecek
2. Tweet metni + görsel önizlemesi + skor Telegram'da gösterilecek
3. "✅ Onayla / ❌ Reddet / ✏️ Düzenle" butonları olacak
4. Onay gelince publish-queue'ya eklenecek, red gelince rejected olarak işaretlenecek
5. Belirli süre içinde yanıt gelmezse otomatik onay (yapılandırılabilir)
