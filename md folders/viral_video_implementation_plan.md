# X Viral Video Radarı & Native Video Embed Sistemi

Bu plan, X (Twitter) platformunda yüksek izlenme ve etkileşim almış (Örn: 1M+ izlenen GTA 6, sızıntı veya donanım demoları) videoları otomatik tespit edip, Gemini AI ile DonanımPost tarzında haberleştirerek **"From @kullanıcıadı"** formatında (tam ekran gömülü video) yayınlama özelliğinin teknik altyapısını tanımlar.

---

## User Review Required

> [!IMPORTANT]
> **API Maliyet Yönetimi:** X API "Pay Per Use" (Kullandıkça Öde) paketinde tweet arama (search) istekleri ücrete tabidir. Bu nedenle rastgele geniş tarama yapmak yerine, günde 2-3 kez **sadece önceden belirlenmiş 15-20 popüler teknoloji/oyun haber hesabının** tweetlerini tarayarak bütçeyi koruyacağız.

> [!NOTE]
> **Native Video Gömme:** Tweet sonuna orijinal tweetin `.../status/{id}/video/1` linki eklenerek paylaşılır. X arayüzü linki gizler ve videoyu doğrudan player olarak gösterip altına `Kimden: @kullanıcıadı` ekler. Telif riski sıfırdır ve video indirme/yükleme maliyeti olmaz.

---

## Open Questions

- **Viral Eşik Değeri:** Bir videonun "Haber Değeri" taşıması için minimum kaç izlenme (Örn: 500.000+) veya kaç beğeni (Örn: 5.000+) almış olmasını tercih edersiniz?
- **Takip Edilecek Hesap Listesi:** İlk etapta izlenecek özel hesaplar var mı? (Örn: @IGN, @GameSpot, @RockstarGames, @NVIDIAGeForce, popüler sızıntı/leak hesapları vb.)

---

## Proposed Changes

### 1. Viral Video Tarayıcı Modülü

#### [NEW] `src/modules/fetcher/viralRadar.ts`
- X API v2 `tweets/search/recent` veya `users/:id/tweets` endpoint'lerini kullanarak belirlenen niş hesaplardaki son 24 saatlik medya içeren tweetleri tarar.
- İzlenme / beğeni eşiğini geçen ve video içeren tweetleri filtreler.
- Kuyruğa `process-queue` üzerinden yeni bir makale/içerik tipi olarak ekler (`sourceType: 'x_viral_video'`).

---

### 2. Yapay Zeka (Gemini) Video Yorumlama

#### [MODIFY] [ai.ts](file:///c:/Users/Bekir/Desktop/software/AutoSocial/src/modules/processor/ai.ts)
- `generateVideoCommentary` fonksiyonu eklenecek.
- Prompt: *"Aşağıdaki viral videonun içeriğini ve bağlamını analiz et. DonanımPost takipçileri için ilgi çekici, etkileşim (anket/soru/şaşırtıcı bilgi) odaklı bir tweet metni oluştur."*
- Çıktı olarak hazır tweet metni + hashtagler üretilecek.

---

### 3. Tweet Yayınlayıcı & Video URL Formatı

#### [MODIFY] [twitter.ts](file:///c:/Users/Bekir/Desktop/software/AutoSocial/src/modules/publisher/twitter.ts)
- `postTweet` fonksiyonuna `videoEmbedUrl` desteği eklenecek.
- Eğer içerik bir viral video ise, tweet metninin sonuna `https://x.com/{author}/status/{tweetId}/video/1` formatında link eklenecek.
- Görsel yükleme adımı atlanacak (çünkü video doğrudan X tarafından gömülecek).

---

### 4. Telegram Bot Onay Önizlemesi

#### [MODIFY] [bot.ts](file:///c:/Users/Bekir/Desktop/software/AutoSocial/src/modules/telegram/bot.ts)
- Viral video onay isteklerinde Telegram'a özel kart tasarımı:
  - 🎬 **VİRAL VİDEO YAKALANDI**
  - **Orijinal Sahip:** @kullaniciadi
  - **İzlenme / Beğeni:** 1.8M / 24K
  - **Önerilen Tweet Metni:** ...
  - **Orijinal Video Linki:** [İzle]
- Butonlar: `🚀 Hemen Yayınla`, `🕒 Sıraya Al`, `❌ Reddet`.

---

## Verification Plan

### Automated Tests
- `scripts/test-viral-embed.ts` betiği oluşturulup örnek bir viral tweet ID'si ile native video embed formatının Twitter üzerinde nasıl göründüğü test edilecek.

### Manual Verification
- Telegram üzerinden viral video onay mesajının testi.
- Onay verildiğinde atılan tweetin X üzerinde tam ekran video ve "Kimden: @..." ibaresiyle çıktığının doğrulanması.
