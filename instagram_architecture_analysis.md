# AutoSocial: Instagram Entegrasyon Analizi

Mevcut AutoSocial mimarisi modüler bir yapıda (Publisher, Processor/AI, Processor/Image) tasarlandığı için Instagram (veya başka bir platform) entegrasyonu yapmak yapısal olarak oldukça uygundur. Projeyi baştan yazmak gerekmez, ancak mevcut modüllerde belirli "genişletmeler" yapmalıyız.

---

## 1. Ne Kadar Değişiklik Yapmamız Gerekir?

Mimari genişletmelerimiz 4 ana modül üzerinde odaklanacaktır:

### 🖼️ Image Processor (`image.ts`) 
> [!NOTE]  
> **Efor: Düşük / Orta**

Şu anki sistem X (Twitter) için optimize edilmiş `1200x675` (16:9) çözünürlüğünde görseller üretiyor. Instagram için bunu:
- **`1080x1080` (Kare - 1:1)** veya 
- **`1080x1350` (Dikey - 4:5)** boyutlarına uyarlamamız gerekecek. 

`sharp` kütüphanesi ile bu uyarlama kolaydır, ancak görselin içindeki başlık ve kaynak metinlerinin `X` ve `Y` koordinatlarının yeni formata göre yeniden hizalanması gerekir. Ayrıca Instagram API'si genellikle JPEG tercih ettiği için WebP formatı yerine JPEG çıktısına geçiş yapmak (veya ikisini ayrı ayrı üretmek) gerekebilir.

### 🧠 AI Processor (`ai.ts`) 
> [!NOTE]  
> **Efor: Düşük**

Mevcut Gemini prompt'unuz özellikle "Maks 240 karakter", "Thread (zincir) oluştur" ve en önemlisi **"HİÇBİR ŞEKİLDE HASHTAG KULLANMA"** kurallarıyla Twitter'a özel ayarlanmış. 

Instagram için yeni bir prompt (veya duruma göre prompt parametresi) oluşturarak:
- Daha uzun açıklamalar (caption)
- Bol hashtag kullanımı (maksimum 30)
- Etkileşime yönelik (örn: "Siz ne düşünüyorsunuz? Yorumlara yazın") bir ton belirlemeliyiz.

### 🚀 Publisher Modülü (`publisher`) 
> [!NOTE]  
> **Efor: Orta**

Mevcut `twitter.ts`'in yanına bir `instagram.ts` yazılması gerekecek. Ortak bir `publish()` arayüzü kurarak (Strategy Pattern mantığı) içeriğin hem X'e hem de Instagram'a gönderilmesi sağlanmalıdır.

### 🗄️ Veritabanı ve Kuyruk (DB) 
> [!NOTE]  
> **Efor: Düşük**

Haberin X'te ve Instagram'da paylaşılıp paylaşılmadığını ayrı ayrı takip etmemiz gerekir. Tablolara platformlara özel yeni state sütunları eklenebilir (örn: `x_published_at`, `ig_published_at`, `ig_post_id`).

---

## 2. Nelere İhtiyacımız Var?

Teknik olarak bu entegrasyonu yapabilmek için dışarıdan bazı gereksinimlerimiz olacak:

> [!IMPORTANT]  
> **Instagram Business veya Creator Hesabı:** Instagram API'sini kullanabilmek için hesabın "Profesyonel" hesaba geçirilmiş olması ve bir Facebook sayfasına bağlı olması zorunludur. Kişisel hesaplarla API kullanılamaz.

> [!IMPORTANT]  
> **Facebook Developer App:** Meta for Developers üzerinden bir uygulama oluşturup, `Instagram Graph API` izinlerini (`instagram_basic`, `instagram_content_publish` vb.) almalıyız. Bu bize gerekli **Access Token**'ları sağlayacak.

> [!WARNING]  
> **Public URL (Statik Dosya Sunumu):** X (Twitter) API'sine görseli doğrudan Buffer (dosya verisi) olarak yükleyebiliyoruz. Ancak Instagram Graph API, paylaşımları yaparken görseli bir public URL olarak (örn: `https://bizim-uygulama.com/images/123.jpg`) bekler. Railway'de bu görselleri kısa süreliğine host edecek basit bir statik sunucu rotasına ihtiyacımız olacak (veya AWS S3/Cloudinary gibi bir yere yükleyip o URL'i Instagram'a vermeliyiz).

---

## 3. Instagram İçin de Başarılı Bir Model Oluşturulabilir Mi?

> [!TIP]  
> **Kesinlikle evet.** Hatta AutoSocial'ın konsepti Instagram için çok daha yüksek bir potansiyel barındırıyor.

- **Kitle ve Format Uyumu:** Sisteminiz şu an "kategoriye göre renklenmiş gradient arka planlar" üzerine tipografik haber başlıkları (`image.ts`) yerleştiriyor. Instagram tamamen görsel tüketim üzerine kurulu olduğu için, bu tür şık, renkli ve okunabilir **"Haber Kartları" (News Cards)** Instagram kitlesinin (kaydırma - scroll) alışkanlıklarına çok daha uygundur.
- **Gelişim Potansiyeli (Carousel):** İlerleyen aşamalarda X için oluşturduğunuz "Thread" yapısını, Instagram için çoklu görsel (Carousel) yapısına çevirebiliriz. İlk görsel sadece vurucu başlık, kaydırınca çıkan ikinci görsel ise Gemini'nin çıkardığı özet olur. Bu, Instagram algoritmasında etkileşimi en çok artıran içerik türüdür.
- **Dezavantaj - Link Yönetimi:** Instagram post açıklamalarında yer alan linkler tıklanabilir değildir. Ancak haberi okuyan kişinin kaynağa gitmesi için *"Detaylar bio'daki linkte"* mantığı kurabilir veya kaynağı görselin en altına (şu an *DonanımPost* yazan yere yakın) belirgin şekilde yazarak bu engeli aşabiliriz.
