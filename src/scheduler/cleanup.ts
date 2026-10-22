import fs from 'fs';
import path from 'path';
import { createLogger } from '../lib/logger.js';

const log = createLogger('scheduler:cleanup');

/**
 * Belirtilen gün sayısından daha eski olan görsel ve videoları output klasörlerinden siler.
 * Varsayılan: 7 gün
 */
export async function cleanupOldMedia(maxAgeDays = 7): Promise<void> {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const targetDirs = [
    { name: 'video', dir: path.join(process.cwd(), 'output', 'videos') },
    { name: 'görsel', dir: path.join(process.cwd(), 'output', 'images') },
  ];

  const now = Date.now();
  let totalDeleted = 0;

  for (const { name, dir } of targetDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);
      let count = 0;

      for (const file of files) {
        if (file === '.gitkeep') continue;

        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          count++;
          totalDeleted++;
          log.debug({ file, type: name }, 'Eski medya dosyası silindi');
        }
      }

      if (count > 0) {
        log.info({ type: name, deletedCount: count, maxAgeDays }, 'Eski medya temizliği yapıldı');
      }
    } catch (error: any) {
      log.error({ err: error.message, type: name }, 'Medya temizliği sırasında hata oluştu');
    }
  }

  if (totalDeleted > 0) {
    log.info({ totalDeleted, maxAgeDays }, 'Haftalık medya temizlik döngüsü tamamlandı');
  }
}

/**
 * Geriye dönük uyumluluk için eski fonksiyon takma adı
 */
export async function cleanupOldVideos(maxAgeMs?: number): Promise<void> {
  const days = maxAgeMs ? Math.round(maxAgeMs / (24 * 60 * 60 * 1000)) : 7;
  await cleanupOldMedia(days);
}
