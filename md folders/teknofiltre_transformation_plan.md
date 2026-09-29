# 🚀 TeknoFiltre 2.0 Kapsamlı Dönüşüm ve Uygulama Planı

Bu plan; AutoSocial'ın "haber botu" mantığından sıyrılarak **TeknoFiltre** markası altında küratör, yüksek etkileşimli ve platform-native bir teknoloji yayınına dönüşmesini sağlayacak adımları içerir.

---

## 📋 Genel Bakış ve Temel Hedefler

| Alan | Eski Durum (AutoSocial / DonanımPost) | Yeni Durum (TeknoFiltre 2.0) |
| :--- | :--- | :--- |
| **Marka Adı** | DonanımPost | **TeknoFiltre** |
| **X Hesabı** | 400 yabancı/ölü takipçi (166 görüntülenme tavanı) | **2022 tarihli temiz hesap (0 takipçi, 0 spam geçmişi)** |
| **Tweet Hacmi** | Günde 8–15 commodity haber | **Günde maks 6–7 seçilmiş, etki değeri yüksek içerik** |
| **Tweet Formatı** | Klasik haber başlığı + kısa özet | **Vurucu Kanca + Haber + 💡 Cebe/İşe Etkisi + 💬 Tartışma Sorusu** |
| **X Görseli** | Görsel üzerine uzun metin ve paragraflar | **Temiz ürün görseli + 3-5 kelimelik dev kanca + minimal logo** |
| **Skorlama** | Sadece matematiksel (Tazelik + Kaynak) | **Negatif filtre + Kopya haber eleme + Gemini Etki Skoru (1-10)** |
| **Instagram** | 200 izlenmede takılan müzikli statik slayt kolajı | **Selamsız kanca ile başlayan AI Seslendirme (TTS) + Dinamik Altyazılı Reels** |
| **Sakin Günler** | Eksik haberle zorlama bülten | **1-2 haber günlerinde 4 slaytlık derinlemesine Carousel postu** |

---

## 🛠️ Faz 1: Marka Kimliği ve Kural Güncellemeleri
* [ ] **autosocial-context.md Güncellemesi:**
  - Tüm "DonanımPost" referansları ve eski kararlar "TeknoFiltre" olarak güncellenecek.
  - Yeni içerik stratejisi, kanca kuralları ve Reels seslendirme standartları bağlama eklenecek.
* [ ] **Sistem Metinleri ve Bildirimler:**
  - Telegram bot bildirimleri, admin panel başlığı, logger ve dışa dönük tüm çıktılarda marka adı **TeknoFiltre** yapılacak.

---

## 🧠 Faz 2: Akıllı Skorlama ve Çöp/Kopya Haber Filtresi
* [ ] **Negatif Filtre & Gürültü Eleme (`scorer.ts`):**
  - Rutin driver yamaları, firmware güncellemeleri, çeyrek dönem şirket raporları, önemsiz kurumsal haberler için negatif puanlama kuralı.
* [ ] **Çoklu Kaynak Deduplication (Kopya Haber Birleştirme):**
  - Aynı GPU/telefon haberini 5 farklı site girdiyse kuyruğu şişirmesini önleyen metin/konu benzerlik filtresi. En erken ve en kapsamlı kaynağın seçilmesi.
* [ ] **Gemini Tüketici Etki Skoru (`impactScore`):**
  - Gemini'ye haberin tüketici cebine, günlük hayatına veya satın alma kararına etkisini 1-10 arası puanlatma.
  - Sadece skoru 7 ve üzeri olan haberlerin onay kuyruğuna düşmesi.
* [ ] **Zaman Dilimi Kotası:**
  - Sabah (maks 2), Öğle (maks 2), Akşam (maks 2-3) şeklinde günde 6-7 tweet tavanı.

---

## ✍️ Faz 3: X (Twitter) İçerik ve Görsel Tasarım Devrimi
* [ ] **Gemini Tweet Prompt Revizyonu (`ai.ts`):**
  - Çıktı şablonu:
    ```text
    [Vurucu Kanca - 1 Cümle]
    
    [Haberin hap özeti - 1-2 cümle]
    
    💡 Bizim Yorumumuz: [Kullanıcının cebine veya geleceğe etkisi]
    
    💬 [Okuyucuyu yorum yapmaya zorlayan soru]
    ```
  - Görsel için 3-5 kelimelik `imageHook` üretimi (Örn: *"PS5'ten 3 Kat Güçlü?"*).
  - Hashtag yasağı korunacak.
* [ ] **Sharp Görsel Motoru Yenileme (`cardGenerator.ts`):**
  - Kart üzerindeki uzun açıklama kutusu ve paragraf metinleri tamamen kaldırılacak.
  - Yüksek çözünürlüklü ürün görseli + şık vignette/gradient.
  - Sol üste minimal **TeknoFiltre** etiketi.
  - Alt üçte birlik alanda büyük, modern tipografiyle sadece 3-5 kelimelik **Kanca**.

---

## 🎙️ Faz 4: Instagram Reels AI Seslendirme (TTS) ve Altyazı Motoru
* [ ] **TTS Modülü Entegrasyonu (`msedge-tts`):**
  - Sıfır maliyetli Microsoft Edge Neural Turkish TTS (`tr-TR-AhmetNeural` veya `tr-TR-EmelNeural`) servisi oluşturulacak.
  - Ses dosyası (`.mp3`) ile birlikte kelime/cümle zamanlamalarını çıkaran altyapı.
* [ ] **Gemini Reels Spiker Metni Üretimi (`ai.ts`):**
  - **Kural:** "Herkese merhaba, selamlar" gibi tüm girişler KESİNLİKLE YASAK.
  - İlk kelime doğrudan merak uyandıran şok kanca ile başlayacak.
  - 3 haber için 25-30 saniyelik doğal konuşma temposunda metin + son 5 saniyede yorum sorusu ve takip çağrısı.
* [ ] **Senkronize Altyazı Üretimi (`.srt`):**
  - Ses dalgasına göre hassas zamanlamalı altyazı dosyası oluşturulacak.
* [ ] **FFmpeg Video Birleştirme Motoru (`digestGenerator.ts`):**
  - Görseller: Her haber konuşulurken ilgili haberin temiz görseli ekranda duracak.
  - Ses Miksi: AI Spiker sesi net ve ön planda; `beat.mp3` arkada kısık (-22dB) çalacak.
  - Altyazı: Reels tarzında (büyük, kalın, gölgeli modern font) videoya gömülecek (burned-in).

---

## 📱 Faz 5: Instagram Carousel (Yedek Format)
* [ ] **Carousel Üretici (`carouselGenerator.ts`):**
  - Günlük haber sayısı 1 veya 2 olduğunda Reels yerine 4 slaytlık Instagram kaydırmalı kart paketi üretilecek:
    * Slayt 1: Büyük Kanca + Ürün Görseli
    * Slayt 2: Olay Ne? (1-2 Cümle Net Bilgi)
    * Slayt 3: Sana / Cebe Etkisi Ne? (💡 Değer Katma)
    * Slayt 4: Sence Değer mi? (💬 Yorum Çağrısı)

---

## 🧪 Faz 6: Test ve Doğrulama
* [ ] `test-ai.ts`: Yeni Kanca + Yorum + Soru formatının doğrulanması.
* [ ] `test-image.ts`: Yeni minimalist kancalı 16:9 X kartının oluşturulup kontrol edilmesi.
* [ ] `test-reels.ts`: Edge TTS + Altyazı + FFmpeg ile 30 saniyelik örnek Reels videosunun render edilip izlenmesi.
* [ ] Kuyruk ve Telegram onay akışında yeni şablonların sorunsuz akışı.
