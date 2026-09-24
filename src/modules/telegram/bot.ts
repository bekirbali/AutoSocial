import { Telegraf, Markup } from 'telegraf';
import { createLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { processedArticles, rawArticles, instagramDigests } from '../../db/schema.js';
import { eq, and, desc, gte } from 'drizzle-orm';
import { publishQueue, removePendingPublishJobs, type PublishJobData } from '../../lib/queue.js';
import { getNextPublishSlot } from '../../scheduler/cron.js';
import { existsSync } from 'fs';
import { isXManualMode } from '../publisher/twitter.js';

const log = createLogger('telegram:bot');


let bot: Telegraf | null = null;

if (env.TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(env.TELEGRAM_BOT_TOKEN, {
    handlerTimeout: 600_000, // 10 dakika (FFmpeg video derleme, Meta Graph API Reels işleme ve video yükleme için)
  });

  bot.catch((err, ctx) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const updateType = ctx?.updateType;
    const actionData = ctx?.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    log.error({ err: errorMsg, updateType, actionData }, 'Telegraf bot hatası (polling / handler)');
  });

  // ─── ACTION HANDLERS ────────────────────────────────────────────────────────

  // Onaylama / Hemen Yayınlama aksiyonu (Çoklu platform desteği eklendi)
  bot.action(/^(pub|queue):(x|ig|all):(.+)$/, async (ctx) => {
    const action = ctx.match[1]; // pub veya queue
    const platform = ctx.match[2]; // x, ig veya all
    const articleId = ctx.match[3];
    if (!articleId) {
      await ctx.answerCbQuery('Hatalı ID');
      return;
    }

    // Telegram client'ındaki buton yükleniyor animasyonunu hemen sonlandır
    await ctx.answerCbQuery(action === 'pub' ? 'Hemen yayınlama başlatıldı...' : 'Sıraya alınıyor...').catch(() => {});

    try {
      // Tekil haberler kural gereği istisnasız yalnızca X'e gider; Instagram toplu bülten (digest) içindir
      const targets = ['x'];

      // 1. Veritabanında durumu 'approved' yap ve platform hedeflerini kaydet
      await db
        .update(processedArticles)
        .set({ status: 'approved', platformTargets: targets, updatedAt: new Date() })
        .where(eq(processedArticles.id, articleId));

      // 2. Publish sırasına (delayed job) ekle
      const publishAt = action === 'pub' ? new Date() : await getNextPublishSlot();
      const delayMs = Math.max(0, publishAt.getTime() - Date.now());

      const publishJobData: PublishJobData = {
        processedArticleId: articleId,
        scheduledFor: publishAt.toISOString(),
      };

      await removePendingPublishJobs(articleId);

      await publishQueue.add(
        `publish:${articleId}`,
        publishJobData,
        { delay: delayMs, jobId: `publish-${articleId}-${Date.now()}` },
      );

      const isManual = await isXManualMode();
      const manualNotice = (isManual && (platform === 'x' || platform === 'all'))
        ? '\n\n🖐 <i>X Manuel Mod devrede: X API çağrısı yapılmadı (0 TL). İçeriği ve görseli elle paylaşabilirsiniz. Saat 13:00/19:00 bültenine dahil edilecektir.</i>'
        : '';

      const platformStr = platform === 'all' ? 'X + Instagram' : (platform === 'ig' ? 'Instagram' : 'X');
      const captionStatus = (action === 'pub' 
        ? `✅ <b>HEMEN YAYINLANDI (${platformStr})</b>`
        : `✅ <b>ONAYLANDI (${platformStr})</b> (Sıraya alındı: ${publishAt.toLocaleTimeString('tr-TR')})`) + manualNotice;


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

      await ctx.answerCbQuery(action === 'pub' ? 'Hemen yayınlanıyor!' : 'Makale sıraya alındı!');
      log.info({ articleId, platform, scheduledFor: publishAt.toISOString(), isImmediate: action === 'pub' }, 'Makale Telegram üzerinden onaylandı');
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

    // Kullanıcıya anında geri bildirim ver
    await ctx.answerCbQuery('Makale reddedildi.').catch(() => {});

    try {
      // 1. Veritabanında durumu 'rejected' yap
      await db
        .update(processedArticles)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(processedArticles.id, articleId));

      // Kuyruktaki delayed işi kaldır
      await removePendingPublishJobs(articleId);

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

      log.info({ articleId }, 'Makale Telegram üzerinden reddedildi');
    } catch (error) {
      log.error({ err: error instanceof Error ? error.message : error }, 'Reddetme hatası');
    }
  });

  // ─── INSTAGRAM DIGEST ACTIONS & COMMANDS ────────────────────────────────────

  // 'noop' tıklama işleyicisi (Yükleniyor butonuna basıldığında)
  bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery('⏳ İşlem devam ediyor, lütfen bekleyin...');
  });

  // Bülten Onaylama veya Pas Geçme aksiyonu
  bot.action(/^digest:(pub|rej):(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const digestId = ctx.match[2];
    if (!digestId) {
      await ctx.answerCbQuery('Hatalı Digest ID');
      return;
    }

    try {
      if (action === 'pub') {
        await ctx.answerCbQuery('🚀 Reels yayını başlatıldı, yükleniyor...');

        // 1. Anında kullanıcıya görsel geri bildirim ver: Butonları yükleniyor durumuna çevir
        await ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [Markup.button.callback('⏳ Instagram\'a Yükleniyor... (Lütfen bekleyin)', 'noop')],
          ],
        }).catch(() => {});

        const { publishDigest } = await import('../publisher/digestManager.js');
        const igResult = await publishDigest(digestId);

        // 2. Mesajı ve butonları yayınlandı olarak güncelle
        await syncDigestStatusToTelegram(digestId, 'published', igResult.igPostUrl, ctx);

        log.info({ digestId, igPostUrl: igResult.igPostUrl }, 'Bülten Telegram üzerinden onaylandı ve yayınlandı');
      } else {
        await ctx.answerCbQuery('Bülten pas geçiliyor...').catch(() => {});

        const { rejectDigest } = await import('../publisher/digestManager.js');
        const rejected = await rejectDigest(digestId);

        if (!rejected) {
          await ctx.reply('⚠️ Bu bülten zaten Instagram\'da yayınlanmış, pas geçilemez!');
          return;
        }

        await syncDigestStatusToTelegram(digestId, 'rejected', undefined, ctx);
        log.info({ digestId }, 'Bülten Telegram üzerinden pas geçildi');
      }
    } catch (err: any) {
      log.error({ err: err.message, digestId }, 'Bülten aksiyon hatası');
      // Hata durumunda butonları tekrar dene şeklinde geri yükle
      if (action === 'pub') {
        await ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [
              Markup.button.callback('🔄 Tekrar Dene', `digest:pub:${digestId}`),
              Markup.button.callback('❌ Pas Geç', `digest:rej:${digestId}`),
            ],
          ],
        }).catch(() => {});
      }
      await ctx.reply(`❌ Bülten işlemi sırasında hata oluştu: ${err.message}`);
    }
  });

  // Manuel /bulten komutu — istenildiği an bülten üretip onaya sunar
  // Kullanım: /bulten (son bültenden bu yana) veya /bulten 12 (son 12 saat)
  bot.command(['bulten', 'digest'], async (ctx) => {
    const args = ctx.message.text.split(/\s+/).slice(1).filter(Boolean);
    let customHours: number | undefined;
    if (args.length > 0) {
      const parsed = parseFloat(args[0]!);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 72) {
        customHours = parsed;
      }
    }

    const isForce = args.some((a) => ['force', 'yeni', 'new'].includes(a.toLowerCase()));

    // 1. Kullanıcı yeni bülten zorlamadıysa, admin panelden son 2 saat içinde derlenmiş
    // ve onay bekleyen ('pending') hazır bir bülten var mı kontrol et
    if (!isForce && !customHours) {
      try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const [pendingDigest] = await db
          .select()
          .from(instagramDigests)
          .where(
            and(
              eq(instagramDigests.status, 'pending'),
              gte(instagramDigests.createdAt, twoHoursAgo),
            ),
          )
          .orderBy(desc(instagramDigests.createdAt))
          .limit(1);

        if (pendingDigest && pendingDigest.videoPath && existsSync(pendingDigest.videoPath)) {
          log.info({ digestId: pendingDigest.id }, 'Panelden derlenmiş bekleyen bülten bulundu, onaya sunuluyor');
          await sendDigestApprovalRequest({
            digestId: pendingDigest.id,
            type: (pendingDigest.type as any) || 'manual',
            articleCount: pendingDigest.articleIds.length,
            videoPath: pendingDigest.videoPath,
            caption: pendingDigest.caption,
            periodInfo: 'Panelden derlenen güncel bülten',
          });
          return;
        }
      } catch (checkErr: any) {
        log.warn({ err: checkErr.message }, 'Bekleyen bülten kontrolü başarısız oldu, yeni oluşturulacak');
      }
    }

    const waitText = customHours
      ? `🎬 Son ${customHours} saatin haberleriyle bülten kontrol ediliyor ve hazırlanıyor, lütfen bekleyin...`
      : '🎬 Son bültenden bu yana yayınlanan haberlerle bülten kontrol ediliyor ve hazırlanıyor, lütfen bekleyin...';

    const statusMsg = await ctx.reply(waitText);
    try {
      const { createDailyDigest } = await import('../publisher/digestManager.js');
      const digest = await createDailyDigest('manual', customHours);

      if (!digest) {
        const rangeText = customHours ? `son ${customHours} saat içinde` : 'son bültenden bu yana';
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          undefined,
          `ℹ️ ${rangeText} X'te yayınlanmış ve henüz bültende yer almamış yeni bir haber bulunamadı.`
        );
      } else {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      }
    } catch (err: any) {
      log.error({ err: err.message }, '/bulten komutunda hata');
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        `❌ Bülten oluşturulurken hata oluştu: ${err.message}`
      );
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
            if (btn.callback_data?.startsWith('queue:')) {
              articleId = btn.callback_data.split(':')[2];
              break;
            } else if (btn.callback_data?.startsWith('pub:')) {
              articleId = btn.callback_data.split(':')[2];
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
        + `<b>Skor:</b> ${article.score}\n`
        + (article.videoPath ? `🎬 <b>Instagram Reels:</b> Hazır (9:16 + Müzik)\n` : '')
        + `\n🐦 <b>X (Twitter) Metni:</b>\n${article.tweetText}\n\n`;

      if (article.instagramCaption) {
        const maxIgLen = 220;
        const igPreview = article.instagramCaption.length > maxIgLen
          ? article.instagramCaption.substring(0, maxIgLen) + '...'
          : article.instagramCaption;
        caption += `📸 <b>Instagram Açıklaması:</b>\n${igPreview}\n\n`;
      }

      if (article.threadTweets && Array.isArray(article.threadTweets) && article.threadTweets.length > 0) {
        caption += `<b>-- Thread Devamı --</b>\n`;
        (article.threadTweets as string[]).forEach((t, i) => {
          caption += `${i + 2}. ${t}\n\n`;
        });
      }

      caption += (raw.url ? `🔗 <a href="${raw.url}">Kaynak Linki</a>` : '');

      if (caption.length > 1020) {
        caption = caption.substring(0, 1015) + '...';
      }

      const buttons = (replyTo as any).reply_markup;

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
    log.warn('TELEGRAM_BOT_TOKEN tanımlı değil, bot başlatılamadı.');
    return;
  }

  try {
    bot.launch({ dropPendingUpdates: true }, () => {
      log.info('🤖 Telegram botu başlatıldı (Polling aktif)');
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
  hasReelVideo?: boolean;
  instagramCaption?: string;
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

  const isManual = await isXManualMode();
  const pubXLabel = isManual ? "🚀 Elle Paylaşıldı Onayla" : "🚀 X'e Hemen Yayınla";
  const queueXLabel = isManual ? "🕒 Sıraya Al (Manuel)" : "🕒 Sıraya Al (X)";

  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback(pubXLabel, `pub:x:${data.articleId}`),
      Markup.button.callback(queueXLabel, `queue:x:${data.articleId}`),
    ],
    [
      Markup.button.callback('✏️ Düzenle', `edit_instruction`),
      Markup.button.callback('❌ Reddet', `reject:${data.articleId}`),
    ],
  ]);

  let caption = `📰 <b>YENİ HABER ONAYI BEKLİYOR</b>\n\n`
    + (isManual ? `🖐 <b>X Modu:</b> MANUEL (0 TL - API Pasif, Elle Paylaşılacak)\n` : '')
    + `<b>Kategori:</b> ${data.category || 'Belirsiz'}\n`
    + `<b>Skor:</b> ${data.score}\n`
    + (data.hasReelVideo ? `🎬 <b>Instagram Reels Videosu:</b> Hazır (9:16 + Müzik)\n` : '')
    + `\n🐦 <b>X (Twitter) Metni:</b>\n${data.tweetText}\n\n`;


  if (data.instagramCaption) {
    // Telegram caption 1024 karakter sınırına takılmamak için özet göster
    const maxIgLen = 220;
    const igPreview = data.instagramCaption.length > maxIgLen
      ? data.instagramCaption.substring(0, maxIgLen) + '...'
      : data.instagramCaption;
    caption += `📸 <b>Instagram Açıklaması:</b>\n${igPreview}\n\n`;
  }

  if (data.threadTweets && data.threadTweets.length > 0) {
    caption += `<b>-- Thread Devamı --</b>\n`;
    data.threadTweets.forEach((t, i) => {
      caption += `${i + 2}. ${t}\n\n`;
    });
  }

  caption += (data.sourceUrl ? `🔗 <a href="${data.sourceUrl}">Kaynak Linki</a>` : '');

  // Telegram sendPhoto 1024 karakter limit koruması
  if (caption.length > 1020) {
    caption = caption.substring(0, 1015) + '...';
  }

  try {
    let sentMsg;
    if (data.imagePath) {
      sentMsg = await bot.telegram.sendPhoto(
        env.TELEGRAM_CHAT_ID,
        { source: data.imagePath },
        { caption, parse_mode: 'HTML', ...buttons }
      );
    } else {
      sentMsg = await bot.telegram.sendMessage(
        env.TELEGRAM_CHAT_ID,
        caption,
        { parse_mode: 'HTML', ...buttons }
      );
    }

    // Admin panel senkronizasyonu için mesaj ID ve caption'ı Redis'e kaydet
    if (sentMsg && sentMsg.message_id) {
      try {
        const { redis } = await import('../../lib/redis.js');
        await redis.set(`tg:msg:${data.articleId}`, sentMsg.message_id, 'EX', 14 * 86400);
        await redis.set(`tg:caption:${data.articleId}`, caption, 'EX', 14 * 86400);
      } catch (redisErr: any) {
        log.warn({ err: redisErr.message }, 'Redis tg:msg kaydı yapılamadı');
      }
    }

    log.debug({ articleId: data.articleId }, 'Onay mesajı Telegram\'a gönderildi');
    return true;
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : error }, 'Telegram onay mesajı gönderilemedi');
    return false;
  }
}

/**
 * Admin panelden bir işlem yapıldığında (Hemen At / Sıraya Al / Pas Geç / Düzenle)
 * Telegram'daki onay mesajının durumunu ve butonlarını günceller
 */
export async function syncArticleStatusToTelegram(
  articleId: string,
  action: 'published' | 'scheduled' | 'rejected' | 'updated',
  details?: { scheduledAt?: Date; newText?: string }
): Promise<void> {
  if (!bot || !env.TELEGRAM_CHAT_ID) return;

  try {
    const { redis } = await import('../../lib/redis.js');
    const msgIdStr = await redis.get(`tg:msg:${articleId}`);
    if (!msgIdStr) {
      log.debug({ articleId }, 'Bu makale için Telegram mesaj ID kaydı bulunamadı');
      return;
    }

    const messageId = parseInt(msgIdStr, 10);
    const originalCaption = (await redis.get(`tg:caption:${articleId}`)) || '';

    let statusText = '';
    if (action === 'published') {
      statusText = '✅ <b>YAYINLANDI (Admin Panel)</b>';
    } else if (action === 'scheduled') {
      const timeStr = details?.scheduledAt ? details.scheduledAt.toLocaleTimeString('tr-TR') : '';
      statusText = `✅ <b>SIRAYA ALINDI (Admin Panel)</b> (Planlanan: ${timeStr})`;
    } else if (action === 'rejected') {
      statusText = '❌ <b>REDDEDİLDİ (Admin Panel)</b>';
    } else if (action === 'updated') {
      statusText = '✏️ <b>METİN DÜZENLENDİ (Admin Panel)</b>';
    }

    // 1. Mesajın altındaki butonları kaldır
    await bot.telegram.editMessageReplyMarkup(
      env.TELEGRAM_CHAT_ID,
      messageId,
      undefined,
      undefined
    ).catch(() => {});

    // 2. Caption veya Text'i yeni durumla güncelle
    let newCaption = originalCaption ? `${originalCaption}\n\n${statusText}` : statusText;
    if (newCaption.length > 1020) {
      newCaption = newCaption.substring(0, 1015) + '...';
    }

    try {
      await bot.telegram.editMessageCaption(
        env.TELEGRAM_CHAT_ID,
        messageId,
        undefined,
        newCaption,
        { parse_mode: 'HTML' }
      );
    } catch {
      await bot.telegram.editMessageText(
        env.TELEGRAM_CHAT_ID,
        messageId,
        undefined,
        newCaption,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    log.info({ articleId, action, messageId }, 'Telegram mesajı admin panel aksiyonuyla güncellendi');
  } catch (err: any) {
    log.warn({ err: err.message, articleId }, 'Telegram senkronizasyonu tamamlanamadı (önemsiz)');
  }
}

export interface DigestApprovalData {
  digestId: string;
  type: 'noon' | 'evening' | 'manual';
  articleCount: number;
  videoPath: string;
  caption: string;
  periodInfo?: string;
}

/**
 * Telegram caption'ının 1024 karakter sınırını aşmamasını garanti eder.
 */
export function formatSafeDigestCaption(baseText: string, statusAppend: string, maxLimit = 1015): string {
  const cleanBase = (baseText || '').trim();
  const neededAppend = `\n\n${statusAppend}`;

  if (cleanBase.length + neededAppend.length <= maxLimit) {
    return `${cleanBase}${neededAppend}`;
  }

  // Sınırı aşıyorsa baseText'i kırp ve sonuna statusAppend ekle
  const allowedBaseLen = Math.max(50, maxLimit - neededAppend.length - 4);
  const truncatedBase = cleanBase.substring(0, allowedBaseLen) + '...';
  return `${truncatedBase}${neededAppend}`;
}

/**
 * Bülten yayınlandığında veya pas geçildiğinde Telegram'daki onay mesajını günceller.
 * İster bot action içinden, ister admin panelden tetiklensin her iki durumda da çalışır.
 */
export async function syncDigestStatusToTelegram(
  digestId: string,
  action: 'published' | 'rejected',
  igPostUrl?: string,
  ctx?: any,
): Promise<void> {
  if (!bot && !ctx) return;

  try {
    const { redis } = await import('../../lib/redis.js');
    let messageId: number | undefined;
    let originalCaption: string | undefined;

    if (ctx?.callbackQuery?.message) {
      messageId = ctx.callbackQuery.message.message_id;
      if ('caption' in ctx.callbackQuery.message) {
        originalCaption = ctx.callbackQuery.message.caption;
      }
    }

    if (!messageId) {
      const msgIdStr = await redis.get(`tg:digest_msg:${digestId}`);
      if (msgIdStr) {
        messageId = parseInt(msgIdStr, 10);
      }
    }

    const redisCaption = await redis.get(`tg:digest_caption:${digestId}`);
    if (redisCaption) {
      originalCaption = redisCaption;
    }

    const statusText = action === 'published'
      ? '✅ <b>INSTAGRAM\'A REELS OLARAK YAYINLANDI!</b>'
      : '❌ <b>BÜLTEN İPTAL EDİLDİ / PAS GEÇİLDİ</b>';

    const newCaption = formatSafeDigestCaption(originalCaption || '', statusText);

    const markup = (action === 'published' && igPostUrl)
      ? Markup.inlineKeyboard([
          [Markup.button.url('🎬 Instagram\'da Görüntüle', igPostUrl)],
        ])
      : Markup.inlineKeyboard([]);

    // Eğer ctx varsa önce onun üzerinden dene
    if (ctx) {
      try {
        await ctx.editMessageCaption(newCaption, {
          parse_mode: 'HTML',
          reply_markup: markup.reply_markup,
        });
      } catch (captionErr: any) {
        log.warn({ err: captionErr.message, digestId }, 'ctx.editMessageCaption başarısız oldu, düz metin fallback deneniyor');
        // HTML parse hatası ihtimaline karşı parse_mode olmadan düz metin dene
        try {
          const plainText = newCaption.replace(/<[^>]+>/g, '');
          await ctx.editMessageCaption(plainText, {
            reply_markup: markup.reply_markup,
          });
        } catch {
          await ctx.editMessageReplyMarkup(markup.reply_markup).catch(() => {});
        }
      }
      return;
    }

    // Admin panel veya harici çağrılarda bot.telegram üzerinden güncelle
    if (bot && env.TELEGRAM_CHAT_ID && messageId) {
      await bot.telegram.editMessageReplyMarkup(
        env.TELEGRAM_CHAT_ID,
        messageId,
        undefined,
        markup.reply_markup
      ).catch(() => {});

      try {
        await bot.telegram.editMessageCaption(
          env.TELEGRAM_CHAT_ID,
          messageId,
          undefined,
          newCaption,
          { parse_mode: 'HTML' }
        );
      } catch (captionErr: any) {
        log.warn({ err: captionErr.message, digestId }, 'bot.telegram.editMessageCaption başarısız oldu, düz metin deneniyor');
        const plainText = newCaption.replace(/<[^>]+>/g, '');
        await bot.telegram.editMessageCaption(
          env.TELEGRAM_CHAT_ID,
          messageId,
          undefined,
          plainText
        ).catch(() => {});
      }
    }
  } catch (err: any) {
    log.error({ err: err.message, digestId }, 'Telegram bülten senkronizasyonu hatası');
  }
}

/**
 * Toplu haber bültenini (Reels videosu ile birlikte) Telegram onayına sunar
 */
export async function sendDigestApprovalRequest(data: DigestApprovalData): Promise<boolean> {
  if (!bot) {
    log.warn('Telegram bot aktif değil, bülten onay mesajı gönderilemedi.');
    return false;
  }

  if (!env.TELEGRAM_CHAT_ID) {
    log.warn('TELEGRAM_CHAT_ID tanımlı değil, bülten onay mesajı gönderilemedi.');
    return false;
  }

  const typeName =
    data.type === 'noon'
      ? '☀️ ÖĞLE TEKNOLOJİ BÜLTENİ'
      : data.type === 'evening'
      ? '🌙 AKŞAM TEKNOLOJİ BÜLTENİ'
      : '⚡️ GÜNÜN TEKNOLOJİ BÜLTENİ';

  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback("🚀 Instagram'a Yayınla", `digest:pub:${data.digestId}`),
      Markup.button.callback('❌ Pas Geç', `digest:rej:${data.digestId}`),
    ],
  ]);

  // Telegram video caption limiti 1024 karakterdir.
  // Onaylandığında mesaja eklenecek durum ibaresi (~50 karakter) için 960 karakter güvenli tavan belirliyoruz.
  const MAX_SAFE_CAPTION_LEN = 960;
  const header = `🎬 <b>DONANIMPOST ${typeName}</b>\n\n`
    + `📊 <b>Kapsanan Haber Sayısı:</b> ${data.articleCount}\n`
    + (data.periodInfo ? `⏱ <b>Aralık:</b> ${data.periodInfo}\n\n` : '\n')
    + `📸 <b>Instagram Açıklaması:</b>\n`;
  const footer = `\n\nInstagram Reels olarak paylaşılsın mı?`;

  const availableCaptionLen = MAX_SAFE_CAPTION_LEN - header.length - footer.length;

  let igPreview = data.caption.trim();
  if (igPreview.length > availableCaptionLen) {
    // Video caption sınırını aşıyorsa satır satır son tam satıra kadar alalım:
    const hint = '\n\n<i>(Detaylı tam açıklama aşağıdaki yanıtta yer almaktadır 👇)</i>';
    const maxLinesLen = availableCaptionLen - hint.length;
    const lines = igPreview.split('\n');
    let accumulated = '';
    for (const line of lines) {
      if ((accumulated + (accumulated ? '\n' : '') + line).length <= maxLinesLen) {
        accumulated += (accumulated ? '\n' : '') + line;
      } else {
        break;
      }
    }
    igPreview = (accumulated || igPreview.substring(0, maxLinesLen)) + hint;
  }

  let text = `${header}${igPreview}${footer}`;

  if (text.length > MAX_SAFE_CAPTION_LEN) {
    text = text.substring(0, MAX_SAFE_CAPTION_LEN - 5) + '...';
  }

  try {
    let sentMsg;
    if (data.videoPath && existsSync(data.videoPath)) {
      sentMsg = await bot.telegram.sendVideo(
        env.TELEGRAM_CHAT_ID,
        { source: data.videoPath },
        { caption: text, parse_mode: 'HTML', ...buttons },
      );
    } else {
      sentMsg = await bot.telegram.sendMessage(
        env.TELEGRAM_CHAT_ID,
        text,
        { parse_mode: 'HTML', ...buttons },
      );
    }

    if (sentMsg && sentMsg.message_id) {
      try {
        const { redis } = await import('../../lib/redis.js');
        await redis.set(`tg:digest_msg:${data.digestId}`, sentMsg.message_id, 'EX', 14 * 86400);
        await redis.set(`tg:digest_caption:${data.digestId}`, text, 'EX', 14 * 86400);
      } catch (redisErr: any) {
        log.warn({ err: redisErr.message }, 'Redis tg:digest_msg kaydı yapılamadı');
      }

      // Kullanıcının metnin tamamını eksiksiz görmesi ve kolayca kopyalayabilmesi için tam açıklamayı yanıt olarak gönder
      await bot.telegram.sendMessage(
        env.TELEGRAM_CHAT_ID,
        `📋 <b>Tam Instagram Reels Açıklaması:</b>\n\n${data.caption}`,
        {
          reply_parameters: { message_id: sentMsg.message_id },
        },
      ).catch((err: any) => log.warn({ err: err.message }, 'Bülten tam metin yanıtı gönderilemedi'));
    }

    log.info({ digestId: data.digestId }, 'Bülten onay mesajı Telegram\'a gönderildi');
    return true;
  } catch (error: any) {
    log.error({ err: error.message }, 'Telegram bülten onay mesajı gönderilemedi');
    return false;
  }
}
