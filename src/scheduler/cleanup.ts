import fs from 'fs';
import path from 'path';
import { createLogger } from '../lib/logger.js';

const log = createLogger('scheduler:cleanup');

/**
 * Belirtilen süreden (milisaniye) daha eski olan videoları output/videos klasöründen siler.
 * Varsayılan: 24 saat
 */
export async function cleanupOldVideos(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  const outputDir = path.join(process.cwd(), 'output', 'videos');
  
  if (!fs.existsSync(outputDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(outputDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (file === '.gitkeep') continue;
      
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        log.debug({ file }, 'Eski video dosyası silindi');
      }
    }

    if (deletedCount > 0) {
      log.info({ deletedCount }, 'Video temizlik (cleanup) işlemi tamamlandı');
    }
  } catch (error: any) {
    log.error({ err: error.message }, 'Video cleanup sırasında hata oluştu');
  }
}
