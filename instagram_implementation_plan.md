# AutoSocial: Instagram Entegrasyonu (PRD & Implementation Plan)

Bu belge, mevcut AutoSocial mimarisine Instagram yayıncılığının (Publishing) eklenmesi için hazırlanmış bir Ürün Gereksinimleri Belgesi (PRD) ve teknik uygulama planıdır.

## Hedef
Haber toplama ve Gemini AI ile içerik oluşturma süreçlerinin bulunduğu mevcut "İçerik Motorunu" kullanarak, içeriklerin hem X'te (Twitter) hem de Instagram'da eşzamanlı veya bağımsız olarak yayınlanmasını sağlamak.

---

## 🛑 User Review Required

Bu plan uygulanmadan önce aşağıdaki kritik konularda karar vermeniz (onayınız) gerekmektedir:

> [!IMPORTANT]
> **1. Instagram Hesabı ve API:** Instagram entegrasyonu için "Instagram Profesyonel (Business/Creator) Hesabı" ve buna bağlı bir "Facebook Sayfası"na ihtiyacımız var. Facebook Developer Console üzerinden uygulama oluşturup **Access Token** almanız gerekecek. Bu kurulumu yapmaya hazır mısınız?

> [!WARNING]
> **2. Görsel Boyut Kararı:** Mevcut 16:9 yatay görseller Instagram akışında küçük kalır. Instagram için **Kare (1080x1080 - 1:1)** mi yoksa **Dikey (1080x1350 - 4:5)** formatı mı varsayılan yapmak istersiniz? (4:5 dikey format ekranda daha fazla yer kapladığı için genellikle daha yüksek etkileşim alır).

> [!CAUTION]
> **3. Public URL Sunumu:** Instagram API, görselleri doğrudan yüklememize izin vermez. Görselin ulaşılabilir bir URL'sini (`https://uygulama.com/image.jpg`) ister. Bunun için projemize basit bir "Statik Dosya Sunucusu" (Fastify/Express üzerinden public klasör) özelliği ekleyeceğiz. Railway üzerinde uygulamanız public bir domaine sahip olacak. Bu durum sizin için uygun mu?

---

## ❓ Open Questions

- Telegram botundan gelen haber onay butonları nasıl olmalı? Öneri: `[X'te Paylaş] [IG'de Paylaş] [İkisinde Paylaş] [Reddet]`
- Şu an X için `generateTweet` fonksiyonu 280 karakter sınırlı. Instagram açıklamaları için Gemini'den ortalama kaç kelimelik/karakterlik bir metin üretmesini isteyelim? (Instagram sınırı 2200 karakterdir).

---

## 🛠️ Proposed Changes

Mevcut projeye entegrasyon için aşağıdaki teknik değişiklikler planlanmaktadır:

### Veritabanı (Database Schema)

Veritabanına Instagram yayınlarını ve analizlerini takip etmek için yeni bir tablo eklenecek ve mevcut `processed_articles` tablosunda platform onay durumları ayrıştırılacaktır.

#### [MODIFY] [schema.ts](file:///c:/Users/Bekir/Desktop/software/AutoSocial/src/db/schema.ts)
- `processedArticles` tablosuna `platformTarget` (örn: `['x', 'instagram']`) eklenecek.
- Yeni `publishedInstagramPosts` tablosu oluşturulacak (Instagram gönderi ID'si, beğeni, yorum istatistikleri için).

### İşleme Katmanı (Processor)

Görsel ve metin üretimi, hedeflenen platforma göre değişken (dinamik) hale getirilecek.

#### [MODIFY] [ai.ts](file:///c:/Users/Bekir/Desktop/software/AutoSocial/src/modules/processor/ai.ts)
- `generateTweet` fonksiyonu `generateSocialPost(..., platform)` olarak genişletilecek veya yeni bir `generateInstagramCaption(...)` eklenecek.
- Instagram için prompt: "Bol hashtag kullan, daha uzun ve etkileşim artırıcı (soru soran) bir açıklama yaz."

#### [MODIFY] [image.ts](file:///c:/Users/Bekir/Desktop/software/AutoSocial/src/modules/processor/image.ts)
- `generateNewsCard(..., format)` parametresi eklenecek.
- `format: '16:9'` (X için - 1200x675) ve `format: '4:5'` (Instagram için - 1080x1350) SVG tasarımları uyarlanacak.

### Yayınlama Katmanı (Publisher)

Instagram Graph API üzerinden gönderi oluşturma mantığı kurulacak.

#### [NEW] `src/modules/publisher/instagram.ts`
- Facebook Graph API entegrasyonu (axios veya fetch ile).
- `createMediaContainer` (URL'den görseli Instagram'a çekme) ve `publishMedia` (gönderiyi yayınlama) fonksiyonları.

#### [MODIFY] [index.ts](file:///c:/Users/Bekir/Desktop/software/AutoSocial/src/modules/publisher/index.ts)
- Telegram'dan gelen onaya göre içeriği `twitter.ts`'e, `instagram.ts`'e veya ikisine birden yönlendiren ana yayınlama yönlendiricisi (dispatcher).

### Telegram Bot

Kullanıcı arayüzü (UI) güncellenerek çoklu platform seçeneği sunulacak.

#### [MODIFY] `src/modules/telegram/bot.ts`
- Inline Keyboard butonları değiştirilerek `[X]`, `[IG]`, `[X + IG]` seçenekleri eklenecek.
- Onaylanan içerik kuyruğa (Redis/BullMQ) hedef platform(lar) belirteciyle atılacak.

---

## ✅ Verification Plan

### Manual Verification
1. Veritabanı şema değişikliklerinin (`pnpm drizzle-kit push`) başarıyla uygulanması.
2. `image.ts` için bir test scripti (`scripts/test-image.ts`) yazılarak hem 16:9 hem de 4:5 formatlarında başarılı görsel üretildiğinin teyit edilmesi.
3. `ai.ts` üzerinden hem kısa Tweet hem de uzun Instagram Caption metinlerinin başarıyla ayrıştırılarak üretilmesi.
4. Test ortamındaki (veya geliştirici hesabındaki) bir Facebook Sayfası / Instagram hesabı üzerinden API aracılığıyla örnek bir postun başarıyla atılması.
