# AutoSocial Projesi: Faz 3 Sonrası Güncel Durum ve Mimari Özeti

Son güncelleme: 30 Ağustos 2026
Mevcut Faz: **Faz 3 Tamamlandı, Faz 4'e Hazırlık**

AutoSocial, donanım ve oyun dünyasındaki gelişmeleri otonom olarak takip edip işleyen, hibrit onay mekanizmasıyla yönetilen uçtan uca bir sosyal medya otomasyon sistemidir.

---

## 1. Mimari ve Altyapı 🏗️

- **Çalışma Ortamı:** Node.js (v20+), TypeScript, pnpm.
- **Daemon Modu:** Sistem `pnpm dev` (veya `start`) ile başlatıldığında bir "daemon" (arka plan servisi) olarak çalışır. `setInterval` veya `setTimeout` kullanmak yerine **BullMQ** ve **Redis** destekli profesyonel bir kuyruk mimarisi kullanılır.
- **Veritabanı:** PostgreSQL (Drizzle ORM). Tablolar: `sources`, `raw_articles`, `processed_articles`, `published_tweets`, `daily_stats`, `system_logs`.
- **Graceful Shutdown:** Sistem `CTRL+C` ile durdurulduğunda yarım kalan işleri tamamlar, DB/Redis bağlantılarını güvenlice kapatır.

## 2. Sistemin Sahip Olduğu Yetenekler ve İş Akışı (Data Flow) 🔄

Sistem 4 temel "Worker" (İşçi) modülü üzerinden çalışır:

### A. Fetch Worker (RSS Toplayıcı)
- **Tetikleyici:** Her 15 dakikada bir çalışan Cron Job.
- **Yetenekler:** 
  - 15 farklı global ve yerel teknoloji/oyun kaynağından veri çeker (PC Gamer, Eurogamer, DonanımHaber vb.).
  - Kaynaklar max 5 paralel istekle taranır. 
  - Üst üste 5 kez hata veren kaynaklar (timeout, 404) otomatik olarak devre dışı bırakılır (`isActive: false`).

### B. Process Worker (Yapay Zeka ve Filtreleme)
- **Yetenekler:**
  - **Deduplication:** Haberin URL'si ve Başlığı (Levenshtein algoritması ile) geçmiş haberlerle karşılaştırılır, kopyalar engellenir.
  - **Scoring (Puanlama):** Haberin başlık ve özeti, `src/config/keywords.ts` içindeki ağırlıklı anahtar kelimeler (örn: RTX 5090, Ücretsiz, İnceleme) ve güncellik durumuna göre puanlanır. **70 puan altı elenir.**
  - **Yapay Zeka (Gemini 1.5 Flash):** Geçer not alan haberler Gemini'a yollanır. Profesyonel, temiz, hashtag içermeyen ve haberi özetleyen Türkçe bir X (Twitter) metni yazdırılır.
  - **Görsel Üretimi (Sharp):** Haberin kategorisine göre (Örn: Oyun=Kırmızı, Teknoloji=Mavi) degrade (gradient) arka planlı, estetik bir haber kartı resmi (JPEG) üretilir.

### C. Telegram Bot (Hibrit Onay Sistemi - Faz 3)
- İşlenen makaleler `pending` (bekliyor) olarak veritabanına kaydedilir.
- Telegraf tabanlı bot anında yöneticinin telefonuna haberin metnini, skorunu ve görselini yollar.
- Mesajdaki `[ ✅ Onayla ]` butonuna basıldığında haber **Publish Queue**'ya (Yayın Kuyruğu) zamanlanarak eklenir. `[ ❌ Reddet ]` ile iptal edilebilir.

### D. Publish Worker (Zamanlanmış Yayınlayıcı)
- **Yetenekler:**
  - Onaylanan haberleri gün içindeki yoğunluğa göre planlar (Örn: Sabah, Öğle, Akşam).
  - Günlük maksimum tweet limitini (örn: 15) aşmaz. Hafta sonları bu limiti %30 oranında düşürerek insan davranışı taklidi yapar.
  - Tweetler arasına anti-bot önlemi olarak "Random Jitter" (±12 dakika rastgele sapma) ekler.
  - Haberi görseliyle birlikte X'te paylaşır, haberin orjinal kaynak linkini ise **ilk yorum (flood/reply)** olarak ekler (X algoritması dış linkleri sevmediği için).

---

## 3. Faz 4 İçin Mevcut Eksikler ve Geliştirme Planı 🚀

Faz 4'te aşağıdaki özelliklerin sisteme dahil edilmesi hedeflenmektedir:

1. **Analytics Worker'ın Canlandırılması (Metrik Takibi)**
   - X API üzerinden son atılan tweetlerin gösterim (impression), beğeni (like) ve retweet verileri çekilecek.
   - Veritabanındaki `published_tweets` ve `daily_stats` tabloları güncellenecek.
2. **Haftalık/Günlük Raporlama (Telegram üzerinden)**
   - Bot, pazar günleri "Bu hafta X takipçi kazandık, en çok şu tweet etkileşim aldı, toplam X tweet atıldı" gibi bir rapor sunacak.
3. **Flood (Thread) Desteği**
   - Uzun haberler veya detaylı incelemeler için tek bir uzun metin yerine, Gemini'ın zincirleme (1/3, 2/3, 3/3 şeklinde) tweet serisi (Thread) oluşturması sağlanacak.
4. **Dinamik Ton Sistemi (Opsiyonel)**
   - Kategoriye veya günün saatine göre Gemini'ın "Ciddi", "Esprili", "Acil Fırsat" gibi farklı diller kullanabilmesi.

---

> **Not:** Bu dosya proje geliştirilirken bir başvuru kılavuzu olarak hizmet edecektir. Şu an kod tarafında hata (error) veya eksik (TODO) kalan kritik bir bug bulunmamaktadır, sistem otonom çalışmaya hazırdır.
