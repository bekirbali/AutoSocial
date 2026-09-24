import { Router } from 'express';
import { db } from '../../db/index.js';
import { processedArticles, publishedTweets, dailyStats } from '../../db/schema.js';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { getTodayPublishedCount } from '../../modules/publisher/scheduler.js';
import { fetchQueue, publishQueue, analyticsQueue } from '../../lib/queue.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { isXManualMode } from '../../modules/publisher/twitter.js';

const log = createLogger('server:routes:overview');

export const overviewRouter: Router = Router();

overviewRouter.get('/', async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Tweet ve kota sayıları
    const todayPublished = await getTodayPublishedCount();
    const maxTweets = env.MAX_TWEETS_PER_DAY;

    // 2. Bekleyen makaleler (Pending)
    const [pendingRow] = await db
      .select({ count: count() })
      .from(processedArticles)
      .where(eq(processedArticles.status, 'pending'));
    const pendingCount = Number(pendingRow?.count ?? 0);

    // 2.1. Ön onaydaki makaleler (Pre-approved)
    const [preApprovedRow] = await db
      .select({ count: count() })
      .from(processedArticles)
      .where(eq(processedArticles.status, 'pre_approved'));
    const preApprovedCount = Number(preApprovedRow?.count ?? 0);

    // 3. Zamanlanmış makaleler (Approved / Scheduled)
    const [scheduledRow] = await db
      .select({ count: count() })
      .from(processedArticles)
      .where(eq(processedArticles.status, 'approved'));
    const scheduledCount = Number(scheduledRow?.count ?? 0);

    // 4. Bugün X'e atılan tweetler
    const [publishedTodayRow] = await db
      .select({ count: count() })
      .from(publishedTweets)
      .where(gte(publishedTweets.publishedAt, todayStart));
    const publishedTodayCount = Number(publishedTodayRow?.count ?? 0);

    // 5. BullMQ Kuyruk Durumları
    const [fetchCounts, publishCounts, analyticsCounts] = await Promise.all([
      fetchQueue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed'),
      publishQueue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed'),
      analyticsQueue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed'),
    ]);

    // 6. Günlük İstatistikler
    const todayStr = todayStart.toISOString().split('T')[0]!;
    const [todayStat] = await db
      .select()
      .from(dailyStats)
      .where(gte(dailyStats.date, todayStr))
      .limit(1);

    res.json({
      success: true,
      data: {
        kpi: {
          todayPublished,
          maxTweets,
          quotaRemaining: Math.max(0, maxTweets - todayPublished),
          pendingCount,
          preApprovedCount,
          scheduledCount,
          publishedTodayCount,
        },
        queues: {
          fetch: fetchCounts,
          publish: publishCounts,
          analytics: analyticsCounts,
        },
        system: {
          mode: env.APP_MODE,
          enableInstagram: env.ENABLE_INSTAGRAM,
          publicUrl: env.APP_PUBLIC_URL || 'http://localhost:3000',
          stats: todayStat ?? null,
          serverTime: new Date().toISOString(),
          xManualMode: await isXManualMode(),
        },

      },
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Overview verisi alınamadı');
    res.status(500).json({ success: false, error: error.message });
  }
});
