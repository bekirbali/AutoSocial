# Faz 4: Dinamik Ton, Flood (Thread) Desteği ve Analytics

Bu doküman, AutoSocial projesinin 4. Fazı olan "Dinamik Ton, Thread Desteği ve Analytics" özelliklerinin teknik uygulama planını içerir. Henüz yayınlanmış tweetimiz olmadığı için Analytics tarafı ön hazırlık olarak kurgulanacak, ağırlık Ton ve Thread özelliklerine verilecektir.

## User Review Required

> [!IMPORTANT]  
> Flood (Thread) desteğinde, X algoritması gereği ana habere ait bağlantı linkini en son tweet'in altına mı yoksa ilk tweet'in hemen altına (mevcut sistemdeki gibi) mı eklemek istersiniz?

## Open Questions

> [!TIP]  
> Dinamik ton sisteminde, her kategori için belirleyeceğimiz rastgele ton havuzuna (örn: oyun için "esprili", "heyecanlı", "eleştirel") eklenmesini istediğiniz özel bir "kişilik" veya "üslup" var mı?

---

## Proposed Changes

### Dinamik Ton Sistemi

Dinamik ton sistemi, yapay zekanın tek tip konuşmasını engelleyip, kategoriye ve bağlama göre rastgele/değişken bir üslup kullanmasını sağlayacaktır.

#### [MODIFY] `src/modules/processor/ai.ts`
- `CATEGORY_PROMPTS` objesindeki tekil `tone` string değeri yerine bir `tones` dizisi (array) tanımlanacak (Örn: oyun kategorisi için `['enerjik', 'esprili', 'merak uyandıran']`).
- `generateTweet` fonksiyonu çağrıldığında bu diziden rastgele bir ton seçilip Gemini prompt'una enjekte edilecek.

---

### Flood (Thread) Desteği

Uzun ve detaylı (örneğin inceleme veya büyük duyurular) haberler için metni kırpmak yerine 2-3 tweetlik zincir (thread) oluşturulacak.

#### [MODIFY] `src/modules/processor/ai.ts`
- Haber metni/özeti belirli bir uzunluğun (örn: 500 karakter) üzerindeyse prompt içine **"Bu haber uzun, lütfen 2 veya 3 tweetlik bir zincir (thread) olarak hazırla"** talimatı eklenecek.
- Gemini'dan beklenen JSON şeması genişletilecek:
  ```json
  {
    "tweetText": "İlk tweet metni",
    "tone": "kullanılan ton",
    "isThread": true,
    "threadTweets": ["İkinci tweet metni", "Üçüncü tweet metni"]
  }
  ```
- Dönen `threadTweets` verisi doğrudan `processed_articles` tablosuna (JSONB olarak) kaydedilecek.

#### [MODIFY] `src/modules/telegram/bot.ts`
- Bot yöneticiden onay isterken, eğer haber bir Thread ise, sadece ilk tweet'i değil alt alta diğer tweetleri de önizleme mesajına (veya yeni bir mesaj olarak) ekleyecek ki yönetici tüm zinciri okuyup onaylayabilsin.

#### [MODIFY] `src/modules/publisher/twitter.ts`
- Mevcut `postReply` fonksiyonu veya yeni bir `postThread` fonksiyonu kullanılarak, eğer makalede `threadTweets` varsa, atılan ilk tweet'in (tweetId) altına sırayla (loop ile) reply olarak diğer tweetler eklenecek.

#### [MODIFY] `src/workers/publishWorker.ts`
- DB'den çekilen makalede `threadTweets` (array) doluysa, Twitter API'ye peş peşe istek atarak thread'in düzgün yayınlanması sağlanacak ve olası hata durumları yönetilecek.

---

### Analytics & Raporlama (Ön Hazırlık)

Şu an yayında tweet olmadığı için gerçek veri çekilememektedir, ancak altyapısı bu fazda kurulacaktır.

#### [NEW] `src/workers/analyticsWorker.ts` (Aktifleştirilecek)
- `published_tweets` tablosundaki son 48 saate ait tweetleri tarayıp X API `twitterReadClient` üzerinden (v2 API veya scraping ile) gösterim, beğeni ve RT sayılarını çekecek.

#### [NEW] `src/modules/telegram/report.ts`
- Pazar günleri çalışacak yeni bir cron job yazılacak.
- Veritabanından o haftanın `daily_stats` verilerini toplayıp, toplam etkileşim ve yayınlanan tweet sayısını hesaplayarak Telegram botu üzerinden yöneticiye haftalık özet gönderecek.

---

## Verification Plan

### Manual Verification
- `pnpm test:ai` scripti güncellenip thread dönme ihtimali olan uzun bir "mock" haber metni ile test edilecek.
- Telegram botu üzerinde gelen test onay mesajında tüm thread'in göründüğü teyit edilecek.
- Onaylanan bir thread'in (Test hesabına bağlıysa) X platformuna doğru zincir (reply sıralaması bozulmadan) şeklinde gidip gitmediği canlı olarak gözlemlenecek.
