import { createLogger } from '../../lib/logger.js';
import { db } from '../../db/index.js';
import { dailyStats } from '../../db/schema.js';
import { gte, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { Telegraf } from 'telegraf';

const log = createLogger('telegram:report');

/**
 * Son 7 günün özetini Telegram'a gönderir
 */
export async function sendWeeklyReport(): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    log.warn('Telegram API veya Chat ID eksik, rapor gönderilemiyor.');
    return;
  }

  // Son 7 günün başı
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);
  const sinceDateString = since.toISOString().split('T')[0] as string;

  try {
    const stats = await db
      .select({
        published: sql<number>`SUM(${dailyStats.articlesPublished})`,
        impressions: sql<number>`SUM(${dailyStats.totalImpressions})`,
        likes: sql<number>`SUM(${dailyStats.totalLikes})`,
        retweets: sql<number>`SUM(${dailyStats.totalRetweets})`,
      })
      .from(dailyStats)
      .where(gte(dailyStats.date, sinceDateString));

    const total = stats[0];
    
    if (!total || !total.published) {
      log.info('Bu hafta hiç istatistik yok, rapor boş gönderiliyor.');
    }

    const message = `📊 <b>HAFTALIK ÖZET RAPORU</b>\n\n` +
      `<b>Yayınlanan Tweet:</b> ${total?.published || 0}\n` +
      `<b>Gösterim (Impression):</b> ${total?.impressions || 0}\n` +
      `<b>Toplam Beğeni:</b> ${total?.likes || 0}\n` +
      `<b>Toplam Retweet:</b> ${total?.retweets || 0}\n\n` +
      `<i>AutoSocial Sistemi otonom olarak çalışmaya devam ediyor...</i> 🚀`;

    const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    await bot.telegram.sendMessage(env.TELEGRAM_CHAT_ID, message, { parse_mode: 'HTML' });
    
    log.info('Haftalık rapor Telegram\'a başarıyla gönderildi.');
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : error }, 'Haftalık rapor gönderilirken hata oluştu');
  }
}
