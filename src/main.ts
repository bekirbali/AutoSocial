import 'dotenv/config';
import { createLogger } from './lib/logger.js';
import { checkDbConnection, db, closeDb } from './db/index.js';
import { checkRedisConnection, closeRedis } from './lib/redis.js';
import { closeQueues } from './lib/queue.js';
import { env } from './config/env.js';
import { sources } from './db/schema.js';
import { SOURCES } from './config/sources.js';
import { createAdminApp } from './server/app.js';

// Workers
import { startFetchWorker } from './workers/fetchWorker.js';
import { startProcessWorker } from './workers/processWorker.js';
import { startPublishWorker } from './workers/publishWorker.js';
import { startAnalyticsWorker } from './workers/analyticsWorker.js';

// Cron & Scheduler
import { registerCronJobs, bootstrapPublishQueue } from './scheduler/cron.js';

// Analytics
import { flushDailyStats } from './modules/analytics/dailyStats.js';

// Telegram
import { startTelegramBot, stopTelegramBot } from './modules/telegram/bot.js';

import type { Worker } from 'bullmq';

const log = createLogger('main');

// Aktif worker'lar (shutdown için)
const activeWorkers: Worker[] = [];

/**
 * AutoSocial — Faz 2 Daemon
 *
 * Boot sırası:
 * 1. DB + Redis bağlantılarını doğrula
 * 2. RSS kaynaklarını seed et (ilk çalıştırma)
 * 3. BullMQ worker'ları başlat
 * 4. Cron job'ları kayıt et (repeat jobs)
 * 5. Bekleyen publish job'larını zamanla (bootstrap)
 * 6. Statik dosya sunucusunu başlat (Instagram için görseller)
 * 7. SIGTERM/SIGINT bekle — kapanmaz
 */
async function main() {
  log.info('🚀 AutoSocial Faz 2 başlatılıyor');
  log.info({ mode: env.APP_MODE, nodeEnv: env.NODE_ENV }, 'Konfigürasyon');

  // ─── 1. Bağlantı Kontrolleri ──────────────────────────────────────────────
  const dbOk = await checkDbConnection();
  const redisOk = await checkRedisConnection();

  if (!dbOk) {
    log.fatal('PostgreSQL bağlantısı kurulamadı! Docker çalışıyor mu? (port 5433)');
    process.exit(1);
  }

  if (!redisOk) {
    log.fatal('Redis bağlantısı kurulamadı! Docker çalışıyor mu?');
    process.exit(1);
  }

  log.info('✅ DB + Redis bağlantıları başarılı');

  // ─── 2. Kaynak Seed (ilk çalıştırma) ─────────────────────────────────────
  await seedSources();

  // ─── 3. Worker'ları Başlat ────────────────────────────────────────────────
  log.info('⚙️ Worker\'lar başlatılıyor...');

  const fetchWorker   = startFetchWorker();
  const processWorker = startProcessWorker();
  const publishWorker = startPublishWorker();
  const analyticsWorker = startAnalyticsWorker();

  activeWorkers.push(fetchWorker, processWorker, publishWorker, analyticsWorker);

  log.info('✅ 4 worker aktif (fetch / process / publish / analytics)');

  // ─── 4. Cron Job'ları Kayıt Et ───────────────────────────────────────────
  await registerCronJobs();

  // ─── 5. Bootstrap: Bekleyen Makaleleri Zamanla ───────────────────────────
  await bootstrapPublishQueue();
  await startTelegramBot();

  // ─── 6. Express Sunucusu & Admin API & Medya Servisi ───────────────────────
  const PORT = Number(process.env.PORT) || 3000;
  const app = createAdminApp();
  const server = app.listen(PORT, () => {
    log.info(`🌐 Admin Panel ve Medya Sunucusu aktif: http://localhost:${PORT}/admin`);
  });

  // ─── 7. Daemon Modu — Kapanma ─────────────────────────────────────────────
  log.info(
    {
      fetchInterval: `${env.FETCH_INTERVAL_MINUTES} dakika`,
      maxTweetsPerDay: env.MAX_TWEETS_PER_DAY,
      analyticsInterval: `${env.ANALYTICS_FETCH_INTERVAL_HOURS} saat`,
      mode: env.APP_MODE,
    },
    '🟢 AutoSocial çalışıyor — Durdurmak için CTRL+C',
  );

  // Process'i açık tut (Worker'lar arka planda çalışıyor)
  await keepAlive();
}

/**
 * Process'i açık tutacak promise — SIGTERM/SIGINT gelene kadar bekler
 */
function keepAlive(): Promise<void> {
  return new Promise((resolve) => {
    // Shutdown sinyalleri process.on handler'larında yakalanıyor
    // Bu promise asla resolve edilmez — intentional
    void resolve; // TypeScript'e söylüyoruz: bu intentional
  });
}

/**
 * Config'deki kaynakları DB'ye ekle (sadece yoksa)
 */
async function seedSources() {
  for (const source of SOURCES) {
    await db
      .insert(sources)
      .values({
        // id'yi vermiyoruz — DB uuid üretiyor
        // url üzerindeki uniqueIndex conflict'i yakalıyor
        name: source.name,
        url: source.url,
        rssUrl: source.rssUrl,
        lang: source.lang,
        reliability: source.reliability,
        categories: source.categories as string[],
        isActive: source.isActive,
      })
      .onConflictDoUpdate({
        target: sources.url,
        set: {
          name: source.name,
          rssUrl: source.rssUrl,
          lang: source.lang,
          reliability: source.reliability,
          categories: source.categories as string[],
          isActive: source.isActive,
        },
      })
      .catch((err) => {
        log.warn({ sourceName: source.name, err: err.message }, 'Kaynak seed edilemedi');
      });
  }
  log.debug({ count: SOURCES.length }, 'Kaynaklar seed edildi');
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  log.info({ signal }, '🛑 Kapatılıyor...');

  try {
    // Worker'ları durdur (aktif job'lar tamamlanana kadar bekle, max 10s)
    log.info('Worker\'lar durduruluyor...');
    await Promise.allSettled(
      activeWorkers.map((w) => w.close()),
    );

    // Queue'ları kapat
    await closeQueues();
    stopTelegramBot(signal);

    // Kalan istatistikleri DB'ye yaz
    log.info('İstatistikler kaydediliyor...');
    await flushDailyStats().catch(() => {});

    // Bağlantıları kapat
    await closeDb();
    await closeRedis();

    log.info('✅ Graceful shutdown tamamlandı');
    process.exit(0);
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : err }, 'Shutdown hatası');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  log.fatal({ err: err.message, stack: err.stack }, 'Yakalanmamış exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ reason }, 'Yakalanmamış promise rejection');
  process.exit(1);
});

main().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : err }, 'Boot hatası');
  process.exit(1);
});
