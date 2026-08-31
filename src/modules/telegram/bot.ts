import { Telegraf, Markup } from 'telegraf';
import { createLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { processedArticles, rawArticles } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { publishQueue, type PublishJobData } from '../../lib/queue.js';
import { getNextPublishSlot } from '../../scheduler/cron.js';

const log = createLogger('telegram:bot');

let bot: Telegraf | null = null;

if (env.TELEGRAM_HTTP_API) {
  bot = new Telegraf(env.TELEGRAM_HTTP_API);

  bot.catch((err) => {
    log.error({ err: err instanceof Error ? err.message : err }, 'Telegraf bot hatası (polling vs.)');
  });

  // ─── ACTION HANDLERS ────────────────────────────────────────────────────────

  // Onaylama / Hemen Yayınlama aksiyonu
  bot.action(/^(approve|publish_now):(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const articleId = ctx.match[2];
    if (!articleId) {
      await ctx.answerCbQuery('Hatalı ID');
      return;
    }

    try {
      // 1. Veritabanında durumu 'approved' yap
      await db
        .update(processedArticles)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(processedArticles.id, articleId));

      // 2. Publish sırasına (delayed job) ekle
      const publishAt = action === 'publish_now' ? new Date() : await getNextPublishSlot();
      const delayMs = Math.max(0, publishAt.getTime() - Date.now());

      const publishJobData: PublishJobData = {
        processedArticleId: articleId,
        scheduledFor: publishAt.toISOString(),
      };

      await publishQueue.add(
        `publish:${articleId}`,
        publishJobData,
        { delay: delayMs, jobId: `publish-${articleId}` },
      );

      // 3. Mesajı güncelle (butonları kaldır, onaylandı yaz)
      const captionStatus = action === 'publish_now' 
        ? `✅ <b>HEMEN YAYINLANDI</b>`
        : `✅ <b>ONAYLANDI</b> (Sıraya alındı: ${publishAt.toLocaleTimeString('tr-TR')})`;

      await ctx.editMessageCaption(
        `${ctx.callbackQuery.message && 'caption' in ctx.callbackQuery.message ? ctx.callbackQuery.message.caption : ''}\n\n${captionStatus}`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
      
      // Metin mesajıysa (görselsiz) text'i güncelle
      if (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message) {
        await ctx.editMessageText(
          `${ctx.callbackQuery.message.text}\n\n${captionStatus}`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }

      await ctx.answerCbQuery(action === 'publish_now' ? 'Hemen yayınlanıyor!' : 'Makale sıraya alındı!');
      log.info({ articleId, scheduledFor: publishAt.toISOString(), isImmediate: action === 'publish_now' }, 'Makale Telegram üzerinden onaylandı');
    } catch (error) {
      log.error({ err: error instanceof Error ? error.message : error }, 'Onaylama hatası');
      await ctx.answerCbQuery('Bir hata oluştu!');
    }
  });

  // Reddetme aksiyonu
  bot.action(/^reject:(.+)$/, async (ctx) => {
    const articleId = ctx.match[1];
    if (!articleId) {
      await ctx.answerCbQuery('Hatalı ID');
      return;
    }

    try {
      // 1. Veritabanında durumu 'rejected' yap
      await db
        .update(processedArticles)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(processedArticles.id, articleId));

      // 2. Mesajı güncelle
      await ctx.editMessageCaption(
        `${ctx.callbackQuery.message && 'caption' in ctx.callbackQuery.message ? ctx.callbackQuery.message.caption : ''}\n\n❌ <b>REDDEDİLDİ</b>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});

      if (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message) {
        await ctx.editMessageText(
          `${ctx.callbackQuery.message.text}\n\n❌ <b>REDDEDİLDİ</b>`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }

      await ctx.answerCbQuery('Makale reddedildi.');
      log.info({ articleId }, 'Makale Telegram üzerinden reddedildi');
    } catch (error) {
      log.error({ err: error instanceof Error ? error.message : error }, 'Reddetme hatası');
      await ctx.answerCbQuery('Bir hata oluştu!');
    }
  });

  // Düzenleme bilgilendirmesi
  bot.action('edit_instruction', async (ctx) => {
    await ctx.answerCbQuery(
      'Metni düzenlemek için, lütfen onay bekleyen mesaja yeni metni yazarak YANIT verin (Reply).',
      { show_alert: true }
    );
  });

  // Metin düzenleme (Reply ile)
  bot.on('text', async (ctx) => {
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) return;
    if (replyTo.from?.id !== ctx.botInfo.id) return;

    let articleId: string | null = null;
    
    if ('reply_markup' in replyTo && replyTo.reply_markup?.inline_keyboard) {
      for (const row of replyTo.reply_markup.inline_keyboard) {
        for (const btn of row) {
          if ('callback_data' in btn) {
            if (btn.callback_data?.startsWith('approve:')) {
              articleId = btn.callback_data.split(':')[1];
              break;
            } else if (btn.callback_data?.startsWith('publish_now:')) {
              articleId = btn.callback_data.split(':')[1];
              break;
            }
          }
        }
        if (articleId) break;
      }
    }

    if (!articleId) return;

    const newText = ctx.message.text.trim();
    if (!newText) return;

    try {
      // 1. Veritabanını güncelle
      await db
        .update(processedArticles)
        .set({ tweetText: newText, updatedAt: new Date() })
        .where(eq(processedArticles.id, articleId));

      // 2. Verileri çekip mesajı güncelle
      const [articleWithRaw] = await db
        .select({
          processed: processedArticles,
          raw: rawArticles,
        })
        .from(processedArticles)
        .innerJoin(rawArticles, eq(processedArticles.rawArticleId, rawArticles.id))
        .where(eq(processedArticles.id, articleId))
        .limit(1);

      if (!articleWithRaw) return;
      const { processed: article, raw } = articleWithRaw;

      let caption = `📰 <b>YENİ HABER ONAYI BEKLİYOR (Düzenlendi)</b>\n\n`
        + `<b>Kategori:</b> ${article.category || 'Belirsiz'}\n`
        + `<b>Skor:</b> ${article.score}\n\n`
        + `<b>Tweet Metni:</b>\n${article.tweetText}\n\n`;

      if (article.threadTweets && Array.isArray(article.threadTweets) && article.threadTweets.length > 0) {
        caption += `<b>-- Thread Devamı --</b>\n`;
        (article.threadTweets as string[]).forEach((t, i) => {
          caption += `${i + 2}. ${t}\n\n`;
        });
      }

      caption += (raw.url ? `🔗 <a href="${raw.url}">Kaynak Linki</a>` : '');

      const buttons = replyTo.reply_markup;

      if ('caption' in replyTo) {
        await ctx.telegram.editMessageCaption(
          replyTo.chat.id,
          replyTo.message_id,
          undefined,
          caption,
          { parse_mode: 'HTML', reply_markup: buttons }
        ).catch(() => {});
      } else {
        await ctx.telegram.editMessageText(
          replyTo.chat.id,
          replyTo.message_id,
          undefined,
          caption,
          { parse_mode: 'HTML', reply_markup: buttons }
        ).catch(() => {});
      }
      
      await ctx.reply('✅ Tweet metni başarıyla güncellendi.', { reply_parameters: { message_id: ctx.message.message_id } });
      log.info({ articleId }, 'Makale metni Telegram üzerinden güncellendi');
    } catch (error) {
      log.error({ err: error instanceof Error ? error.message : error }, 'Düzenleme işlemi sırasında hata');
      await ctx.reply('❌ Metin güncellenirken bir hata oluştu.', { reply_parameters: { message_id: ctx.message.message_id } });
    }
  });
}

// ─── PUBLIC FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Botu başlatır (Long polling modunda)
 */
export async function startTelegramBot(): Promise<void> {
  if (!bot) {
    log.warn('TELEGRAM_HTTP_API tanımlı değil, bot başlatılamadı.');
    return;
  }

  try {
    bot.launch({ dropPendingUpdates: true }).then(() => {
      log.info('🤖 Telegram botu başlatıldı');
    }).catch((err) => {
      log.error({ err: err instanceof Error ? err.message : err }, 'Telegram bot başlatılamadı (başka bir process çalışıyor olabilir)');
    });
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : err }, 'Telegram bot başlatma hatası');
  }
}

/**
 * Botu güvenlice durdurur
 */
export function stopTelegramBot(signal: string): void {
  if (bot) {
    bot.stop(signal);
    log.info('🤖 Telegram botu durduruldu');
  }
}

export interface ApprovalRequestData {
  articleId: string;
  tweetText: string;
  score: number;
  imagePath?: string;
  sourceUrl?: string;
  category?: string;
  threadTweets?: string[];
}

/**
 * Makaleyi Telegram'a onaya sunar
 */
export async function sendApprovalRequest(data: ApprovalRequestData): Promise<boolean> {
  if (!bot) {
    log.warn('Telegram bot aktif değil, mesaj gönderilemedi.');
    return false;
  }

  if (!env.TELEGRAM_CHAT_ID) {
    log.warn('TELEGRAM_CHAT_ID tanımlı değil, onay mesajı gönderilemedi.');
    return false;
  }

  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback('🚀 Hemen Yayınla', `publish_now:${data.articleId}`),
      Markup.button.callback('🕒 Sıraya Al', `approve:${data.articleId}`),
    ],
    [
      Markup.button.callback('✏️ Düzenle', `edit_instruction`),
      Markup.button.callback('❌ Reddet', `reject:${data.articleId}`)
    ],
  ]);

  let caption = `📰 <b>YENİ HABER ONAYI BEKLİYOR</b>\n\n`
    + `<b>Kategori:</b> ${data.category || 'Belirsiz'}\n`
    + `<b>Skor:</b> ${data.score}\n\n`
    + `<b>Tweet Metni:</b>\n${data.tweetText}\n\n`;

  if (data.threadTweets && data.threadTweets.length > 0) {
    caption += `<b>-- Thread Devamı --</b>\n`;
    data.threadTweets.forEach((t, i) => {
      caption += `${i + 2}. ${t}\n\n`;
    });
  }

  caption += (data.sourceUrl ? `🔗 <a href="${data.sourceUrl}">Kaynak Linki</a>` : '');

  try {
    if (data.imagePath) {
      await bot.telegram.sendPhoto(
        env.TELEGRAM_CHAT_ID,
        { source: data.imagePath },
        { caption, parse_mode: 'HTML', ...buttons }
      );
    } else {
      await bot.telegram.sendMessage(
        env.TELEGRAM_CHAT_ID,
        caption,
        { parse_mode: 'HTML', ...buttons }
      );
    }
    log.debug({ articleId: data.articleId }, 'Onay mesajı Telegram\'a gönderildi');
    return true;
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : error }, 'Telegram onay mesajı gönderilemedi');
    return false;
  }
}
