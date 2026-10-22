---
trigger: always_on
---

# TeknoFiltre Proje Bağlamı ve Kararları

## Proje Nedir?
AutoSocial kod tabanı üzerinde koşan **TeknoFiltre**; PC donanım, çevre birimleri, oyun ve akıllı telefon/mobil teknoloji (iPhone, Samsung vb.)
haber kaynaklarından otomatik içerik toplayıp gereksiz gürültüyü filtreleyen, tüketiciye/cebe etkisini analiz eden ve Gemini AI ile özetleyen;
Telegram bot üzerinden hibrit onay akışıyla X (Twitter) ve Instagram'a yayın yapan otonom bir teknoloji küratörüdür.

## Mevcut X ve Instagram Hesabı Durumu
- X: 2022'de açılmış, 0 takipçi, 0 gönderili tertemiz ve güvenli hesap (Eski 400 takipçili yabancı/ölü kitleli hesap terk edildi).
- X Premium aboneliği hesap oturduğunda test edilecek.
- Instagram: @bekirdev43 (Reels ve Carousel odaklı yayın yapılacak).
- Başlangıç hedefi: Telegram üzerinden onaylı (hibrit) mod.

## Kesinleşmiş Teknik Kararlar

### Sosyal Medya Marka Kimliği ve Tasarım Değişmezleri (Invariants)
1. **Marka İsmi (TeknoFiltre):**
   - X (Twitter), Instagram, Telegram bildirimleri ve üretilen tüm görsel/video kartlarında marka adı istisnasız **TeknoFiltre** olarak geçer.
   - "AutoSocial" yalnızca dahili kod tabanı / repo adıdır; dışa dönük hiçbir içerikte **ASLA** görünemez. "DonanımPost" markası tamamen terk edilmiştir.

2. **Kategori Adları ve Rozetleri Yasağı:**
   - Şablonlarda kategori adı veya kategori rozeti **KESİNLİKLE KULLANILMAZ**.
   - Kategori sınıflandırması yalnızca sistemin iç mantığında kullanılır.

### Görsel ve Video Stratejisi: Temiz X Kartı + Instagram AI Sesli Reels & Carousel
- **X (Twitter) Görseli:** 16:9 formatında (`1200x675`). Görsel üzerinde uzun paragraf veya metin kutuları **YASAKTIR**. Orijinal ürün görseli üzerine hafif gradient, sol üste minimal "TeknoFiltre" etiketi ve alt üçte bire sadece **3-5 kelimelik vurucu kanca (hook)** basılır.
- **X (Twitter) Tweet Formatı (Tam Olarak 2 Paragraf - Doğal Editör Dili):**
  ```text
  [1. Paragraf: Vurucu Kanca - Akışı durduran, merak uyandıran tek cümlelik tespit]

  [2. Paragraf: Detay ve Etki - Somut verilerle haberin ne olduğu ve tüketiciye/kullanıcıya etkisi. İsteğe göre samimi bir soru veya net bir kişisel yorumla biter]
  ```
  "Kısacası", "Yani özetle", "Bu da pratikte", "Özetle" gibi yapay zeka bağlaçları KESİNLİKLE YASAKTIR.
  "💡", "💬", "Cebe Etkisi:", "Bizim Yorumumuz:" gibi yapay zeka klişesi etiket ve emojiler KESİNLİKLE KULLANILMAZ.
  Hashtag ve flood/thread KULLANILMAZ. Günde maksimum 6–7 seçilmiş tweet atılır.
- **Instagram Reels (AI Seslendirme + Dinamik Altyazı):**
  - "Herkese merhaba, selamlar" gibi girişler **KESİNLİKLE YASAKTIR**. İlk saniyeden merak uyandıran doğrudan kanca ile başlar.
  - Microsoft Edge Neural TTS (`tr-TR-AhmetNeural`) ile doğal Türkçe seslendirme yapılır.
  - FFmpeg ile ses dalgasına senkronize modern, kalın gölgeli altyazılar videoya gömülür.
  - Arka plan ritmik müziği spiker sesinin altında kısık (-22dB) çalar.
  - Slaytlar sesin konuşma sürelerine göre dinamik akar.
- **Instagram Carousel (1-2 Haber Günleri İçin):**
  - Haber sayısı 1-2 olan sakin günlerde 4 slaytlık kaydedilebilir Carousel kartı üretilir (Hook -> Olay -> Cebe Etkisi -> Tartışma).

### Akıllı Skorlama ve Çöp/Kopya Haber Filtresi
- **Negatif Filtre:** Rutin driver yamaları, firmware güncellemeleri, çeyrek mali raporlar elenir.
- **Deduplication:** Farklı kaynaklardan gelen aynı haberler birleştirilir, yalnızca en detaylı ve ilk kaynak işlenir.
- **Gemini Tüketici Etki Skoru (`impactScore`):** Haberin tüketici cebine/hayatına etkisi 1-10 puanlanır, 7 altı elenir.
- **Zaman Dilimi Kotası:** Sabah (maks 2), Öğle (maks 2), Akşam (maks 2-3) şeklinde günde 6-7 tweet tavanı uygulanır.

### Reddit Viral Teknoloji & Video Arbitraj Stratejisi
- Hedef: Robotik, singularity, yapay zeka ve sıra dışı donanım videoları (yt-dlp ile indirilip işlenir).
- Public JSON/RSS engellendiği için scraping yapılmaz.

### Tünel Çözümü (Instagram Graph API İçin)
- `cloudflared` (Cloudflare Tunnel) kullanılır.

### API Listesi
1. X Developer API 
2. Gemini API Key (Gemini 1.5 kullanıma tamamen kapatılmıştır. İstisnasız yalnızca Gemini 3.5 Flash veya 3.6 Flash kullanılır.)
3. Telegram Bot Token 
4. Facebook Graph API (Instagram System User Never-Expiring Token)

### DB & Queue Yönetimi (Idempotency)
- Veritabanı: PostgreSQL (Drizzle ORM) + Redis
- Kuyruk: BullMQ (Retry mekanizması: attempts: 3, DB bazlı idempotency).