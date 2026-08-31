# 📊 AutoSocial — Proje Analizi
> **Kaynak:** `otomatik_haber_x_otomasyonu.pdf`  
> **Analiz tarihi:** 28 Ağustos 2026

---

## ✅ Doğru Düşünülenler

### 1. RSS-First Yaklaşımı
RSS feed'lerini birincil veri kaynağı olarak seçmek **mükemmel bir karar**. Avantajları:
- Telif/yasal sorunlardan büyük ölçüde korunma
- Sunucu yükü oluşturmaz (hedef siteye saygılı)
- Haber sitelerinin zaten sunduğu resmi bir kanal
- Cheerio/Puppeteer gibi araçların aksine kırılgan değil

### 2. LLM Entegrasyonu (Gemini API)
X'in 280 karakter sınırına uygun özetleme için LLM kullanmak doğru bir tercih. Manuel şablon yerine dinamik özetleme, içerik kalitesini artırır.

### 3. Bot Tespit Stratejileri — Random Jitter
Sabit zamanlı gönderi yerine rastgele gecikme eklenmesi çok önemli bir detay. Bu, en basit bot tespit mekanizmalarını atlatan temel bir önlem.

### 4. Hashtag Sınırlaması (1-2 Max)
Fazla hashtag kullanımının erişimi düşürdüğüne dair X algoritması davranışı doğru tespit edilmiş. Araştırmalar 1-2 hashtag'in optimal olduğunu gösteriyor.

### 5. Hibrit Onay Modeli (Slack/Telegram)
%100 otonom yerine insan onaylı bir akış önermek güvenlik açısından gerçekçi ve sürdürülebilir. Özellikle başlangıç aşamasında kritik.

### 6. Link'i İlk Yoruma Taşıma
Tweet metninden linki kaldırıp ilk yoruma eklemek, X algoritmasının dış link içeren tweetleri bastırma davranışını atlatmak için bilinen en etkili taktiklerden biri. ✔️

### 7. Teknoloji Stack Seçimi
Node.js + TypeScript + twitter-api-v2 kombinasyonu, ekosistemde en olgun ve belgelenmiş yol. Sharp görsel işleme için de doğru seçim.

---

## ⚠️ Eksik veya Geliştirilmesi Gereken Alanlar

### 1. 🗄️ Veritabanı / Durum Yönetimi — KRİTİK EKSİK
PDF'de **hiç veritabanı veya kalıcı durum yönetiminden bahsedilmiyor**. Olmadan:
- Aynı haber **defalarca paylaşılır** (duplicate tweet = ban riski)
- Hangi haberlerin paylaşıldığı takip edilemez
- Sistem çöküp yeniden başlarsa tüm geçmiş kaybolur

**Öneri:**
```
SQLite (lokal, basit) → PostgreSQL (production)
Redis (hızlı kontrol için haber URL hash cache)
```

### 2. 📈 İçerik Skoru / Önceliklendirme Algoritması — Yüzeysel
PDF "önem skoru yüksek 8-15 haber seç" diyor ama bu skoru **nasıl hesaplayacağını anlatmıyor**. 

**Eksik detaylar:**
- Anahtar kelime ağırlıklandırması nasıl yapılacak?
- Zaman faktörü (eski haber vs. kırılma haberi) nasıl değerlendirilecek?
- Birden fazla kaynaktan gelen aynı haber için tekilleştirme nasıl yapılacak?

**Öneri:** Haber skorlama için şu faktörler değerlendirilmeli:
- **Freshness** (yayın zamanı — ağırlık: %40)
- **Anahtar kelime eşleşmesi** (ağırlık: %30)
- **Kaynak güvenilirliği** (whitelisted site mi?) (ağırlık: %20)
- **Başlık uzunluğu & engagement potansiyeli** (ağırlık: %10)

### 3. 🔐 Hata Yönetimi & Rate Limiting — Hiç Bahsedilmemiş
X API'nin **rate limit**'leri var. Aşıldığında:
- Hesap geçici olarak askıya alınabilir
- Uygulama API erişimini kaybedebilir

**Eksik konular:**
- X API v2 ücretsiz katman: **ayda 1.500 tweet** sınırı
- Exponential backoff stratejisi
- API hata kodlarının yönetimi (429, 503 vb.)
- Fallback mekanizmaları (API çökerse ne olur?)

### 4. 📸 Görsel İşleme Stratejisi — Yasal Risk
Kaynak sitelerden indirilen kapak görselleri **telif hakkı korumalı olabilir**. "Marka logosu ekleyerek yeniden boyutlandırma" telif ihlali riskini sıfırlamaz.

**Daha güvenli alternatifler:**
- Unsplash / Pexels API'den free-to-use görsel çekme
- AI görsel üretimi (DALL-E, Imagen) — haber konusuna uygun
- Metin tabanlı görsel tasarım (başlık + arka plan + logo, fotoğraf yok)
- Open Graph meta görsellerini kullanmak (bazı siteler izin verir)

### 5. 💾 Çoklu Hesap & Niş Yönetimi — Ölçeklenme Stratejisi Yok
PDF tek bir hesap üzerinden konuşuyor. Gerçek bir gelir modeli için:

**Eksik:**
- Birden fazla niş hesap nasıl yönetilir? (teknoloji hesabı + ekonomi hesabı + spor hesabı)
- Hesap başına ayrı API credential yönetimi
- Merkezi dashboard ile tüm hesapları izleme

### 6. 🔍 SEO & Keşfedilebilirlik Stratejisi — Yok
Yalnızca tweet atma değil, hesabı büyütme stratejisi eksik:
- Trending topic'lere (gündem) otomatik bağlanma
- Yanıt zinciri (reply thread) oluşturarak erişim artırma
- Rakip hesapların içeriklerini analiz etme
- En iyi paylaşım saatleri (peak hours) tespiti

### 7. 📊 Analytics & Geri Bildirim Döngüsü — Yok
Sistem çalıştıktan sonra **neyin işe yarayıp neyin yaramadığını** ölçme mekanizması yok:
- Hangi haber kategorileri daha fazla etkileşim alıyor?
- Hangi saat dilimlerinde paylaşım daha iyi performans gösteriyor?
- Hangi özetleme tonu (ciddi/meraklı/gündelik) daha çok beğeni alıyor?

**Öneri:** Twitter API v2'nin engagement endpoint'leri ile otomatik A/B test döngüsü kurulabilir.

---

## ❌ Yanlış veya Sorunlu Yaklaşımlar

### 1. 💸 Gelir Beklentileri Gerçekçi Değil
PDF, X Reklam Gelir Paylaşımını sanki erişilebilir bir hedef gibi sunuyor. Gerçekte:

| Gereksinim | Zorluk Seviyesi |
|---|---|
| 500 organik takipçi | Kolay (~1-3 ay) |
| X Premium aboneliği | Ücretli (~$8/ay) |
| **5 milyon organik görüntülenme** (3 ayda) | **Çok Zor** |

5 milyon organik görüntülenme küçük/yeni hesaplar için **neredeyse erişilmez** bir eşik. Bot hesaplar genellikle organik büyüme yetersizliği nedeniyle bu eşiği geçemiyor. PDF bunu "başarılması zor ama mümkün" diye nitelendirmeli, kolay hedefinmiş gibi sıralamalı.

### 2. ⚡ Vercel Cron Yanlış Platform Seçimi
Vercel Cron, **serverless** mimaride çalışır ve her tetiklemede soğuk başlama (cold start) yaşar. Otomasyon botu için:
- Uzun süreli browser session gerektiğinde (Puppeteer) sorun çıkarır
- Ücretsiz katmanda dakika başına sınırlama var
- Stateful işlemler için uygun değil

**Daha iyi alternatifler:**
- **Railway.app** veya **Render.com** (her zaman açık, ücretsiz katmanlı)
- **GitHub Actions** (ücretsiz 2000 dakika/ay, iyi belgelenmiş)
- **VPS/DigitalOcean Droplet** (tam kontrol, $4-6/ay)

### 3. 🕷️ Puppeteer/Playwright — Production'da Sorunlu
PDF web scraping için Puppeteer/Playwright öneriyor ancak:
- **Yüksek RAM tüketimi** (her browser instance ~150-300MB)
- Serverless ortamlarda çalıştırmak karmaşık
- Headless browser'ların tespit edilmesi kolaylaştı (Cloudflare vb.)
- Bakım maliyeti yüksek (site yapısı değişince kırılır)

**Öneri:** RSS olmayan siteler için önce **Cheerio + Axios** (lightweight) dene; başarısız olursa son çare olarak Puppeteer kullan.

### 4. 📝 "Dinamik Prompt Mühendisliği" Yüzeysel Tanımlanmış
"Farklı anlat tonları rastgele seç" demek yeterli değil. Tek prompt'a "bazen ciddi bazen eğlenceli ol" demek LLM'in tutarsız çıktı üretmesine neden olabilir.

**Doğru yaklaşım:**
- Her ton için **ayrı, test edilmiş prompt template'leri**
- Ton seçiminin rastgele değil, haber kategorisine göre yapılması (ekonomi haberi = ciddi, teknoloji haberi = meraklı)
- Çıktı kalite kontrolü (karakter sayısı, emoji yoğunluğu, CTA varlığı)

---

## 🚀 Ek Öneriler — PDF'de Hiç Bahsedilmeyen Konular

### 1. Çoklu Kaynak Deduplication
Aynı olayı birden fazla kaynak haberleştirdiğinde sisteme aynı haber birden giriyor. **Semantic similarity** (benzer başlıkları tespit et) veya basit URL hash tabanlı tekilleştirme şart.

### 2. İçerik Moderasyon Katmanı
Otomatik sistemlerin yanlış veya zararlı içerik paylaşması hesabın kalıcı olarak askıya alınmasına yol açabilir. Minimum:
- Yasak anahtar kelime listesi (NSFW, şiddet, yanlış bilgi flagleri)
- Belirli kaynaklardan gelen içeriği otomatik reddetme (güvenilmez kaynaklar)
- Paylaşım öncesi basit bir content policy check

### 3. Webhook / Gerçek Zamanlı Bildirim
Yalnızca cron yerine bazı büyük haber kaynakları **WebSub/PubSubHubbub** protokolü destekler. Bu, RSS'i her 15 dakikada çekmek yerine anlık kırılma haberlerini saniyeler içinde almayı sağlar.

### 4. Thread (Konu) Formatı
Uzun haberler için tek tweet yerine **otomatik thread** oluşturma çok daha yüksek etkileşim alır ve X algoritması tarafından tercih edilir.

### 5. Çoklu Platform Desteği (Gelecek)
Altyapı en baştan **platform-agnostik** tasarlanırsa aynı sistem:
- Threads (Meta)
- Bluesky (AT Protocol)
- LinkedIn
platformlarına da içerik gönderebilir. Bu, ROI'yi önemli ölçüde artırır.

---

## 📋 Özet Tablo

| Konu | Durum | Öncelik |
|---|---|---|
| RSS-First yaklaşımı | ✅ Doğru | — |
| LLM özetleme | ✅ Doğru | — |
| Random jitter | ✅ Doğru | — |
| Link ilk yoruma | ✅ Doğru | — |
| **Veritabanı / state yönetimi** | ❌ Eksik | 🔴 Kritik |
| **Rate limiting & hata yönetimi** | ❌ Eksik | 🔴 Kritik |
| **Görsel telif stratejisi** | ⚠️ Riskli | 🟠 Yüksek |
| **Haber skorlama algoritması** | ⚠️ Yüzeysel | 🟠 Yüksek |
| **Deduplication** | ❌ Eksik | 🟠 Yüksek |
| İçerik moderasyon | ❌ Eksik | 🟡 Orta |
| Analytics & A/B test | ❌ Eksik | 🟡 Orta |
| Çoklu hesap yönetimi | ❌ Eksik | 🟡 Orta |
| Thread formatı | ❌ Eksik | 🟢 Düşük |
| Çoklu platform | ❌ Eksik | 🟢 Düşük |
| **Vercel Cron seçimi** | ❌ Yanlış | 🟠 Yüksek |
| **Gelir beklentileri** | ❌ Gerçekçi değil | 🟠 Yüksek |
| Puppeteer varsayılan araç | ⚠️ Ağır | 🟡 Orta |
