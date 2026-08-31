# Docker Desktop Kurulum & AutoSocial Setup

## 1. Docker Desktop İndir ve Kur

👉 **İndirme Linki:** https://www.docker.com/products/docker-desktop/

**Adımlar:**
1. Sayfadan "Download for Windows" butonuna tıkla
2. `Docker Desktop Installer.exe`'yi çalıştır
3. Kurulum sırasında **"WSL 2"** seçeneğini işaretli bırak
4. Kurulum tamamlandıktan sonra **bilgisayarı yeniden başlat**
5. Docker Desktop'u aç ve tepside Docker simgesinin yeşil olduğunu doğrula

> [!NOTE]
> Docker Desktop açıkken PowerShell'de `docker --version` komutunu çalıştır. Sürüm numarası görüyorsan kurulum başarılı.

---

## 2. Kurulum Sonrası — Tek Seferlik Komutlar

Docker Desktop açıkken **AutoSocial klasöründe** PowerShell aç ve sırayla çalıştır:

```powershell
# PostgreSQL + Redis başlat
docker compose up -d

# DB migration oluştur ve uygula
pnpm db:generate
pnpm db:migrate
```

---

## 3. Test Betikleri

```powershell
# RSS çekme testi (DB/Redis gerektirmez)
pnpm test:fetch

# Gemini AI tweet üretim testi
pnpm test:ai

# Sharp görsel üretim testi (output/images/ klasörüne kaydeder)
pnpm test:image

# X API bağlantı testi (GERÇEK tweet atar, sonra sil)
pnpm test:tweet
```

---

## 4. Ana Pipeline Çalıştırma

```powershell
# Test modunda (tweet atmaz, sadece DB'ye yazar)
$env:TEST_MODE="true"; pnpm dev

# Hibrit modda (işler, Telegram onayı bekler — Faz 3'te aktif)
pnpm dev
```

---

> [!TIP]
> Kurulum tamamlandıktan sonra bana haber ver, migration ve test adımlarını birlikte yapacağız!
