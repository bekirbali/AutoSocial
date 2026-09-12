import { Router } from 'express';
import {
  fetchQueue,
  publishQueue,
  analyticsQueue,
  type FetchJobData,
} from '../../lib/queue.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('server:routes:queues');
export const queuesRouter: Router = Router();

const queueMap = {
  fetch: fetchQueue,
  publish: publishQueue,
  analytics: analyticsQueue,
};

// ─── 1. Kuyruk Detaylarını Listele ─────────────────────────────────────────────
queuesRouter.get('/', async (_req, res) => {
  try {
    const [fetchJobs, publishJobs, analyticsJobs] = await Promise.all([
      fetchQueue.getJobs(['active', 'delayed', 'failed', 'waiting'], 0, 20),
      publishQueue.getJobs(['active', 'delayed', 'failed', 'waiting'], 0, 30),
      analyticsQueue.getJobs(['active', 'delayed', 'failed', 'waiting'], 0, 20),
    ]);

    const formatJob = (j: any) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      timestamp: j.timestamp,
      delay: j.delay,
      failedReason: j.failedReason,
      state: j.getState ? j.getState() : undefined,
    });

    res.json({
      success: true,
      data: {
        fetch: fetchJobs.map(formatJob),
        publish: publishJobs.map(formatJob),
        analytics: analyticsJobs.map(formatJob),
      },
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Kuyruk işleri alınamadı');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 2. Hatalı İşi Yeniden Dene (Retry) ────────────────────────────────────────
queuesRouter.post('/retry/:queueName/:jobId', async (req, res): Promise<void> => {
  const { queueName, jobId } = req.params;
  const queue = queueMap[queueName as keyof typeof queueMap];

  if (!queue) {
    res.status(404).json({ success: false, error: 'Kuyruk bulunamadı' });
    return;
  }

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      res.status(404).json({ success: false, error: 'İş bulunamadı' });
      return;
    }

    await job.retry();
    log.info({ queueName, jobId }, 'Kuyruk işi yeniden başlatıldı (retry)');
    res.json({ success: true, message: `İş (${jobId}) başarıyla yeniden başlatıldı` });
  } catch (error: any) {
    log.error({ err: error.message, queueName, jobId }, 'Retry hatası');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 3. Manuel RSS Fetch Tetikle ──────────────────────────────────────────────
queuesRouter.post('/trigger-fetch', async (_req, res) => {
  try {
    await fetchQueue.add('fetch-manual', {
      triggeredBy: 'manual',
      timestamp: Date.now(),
    } satisfies FetchJobData);

    log.info('Panelden manuel RSS fetch tetiklendi');
    res.json({ success: true, message: 'RSS taraması arka planda başlatıldı' });
  } catch (error: any) {
    log.error({ err: error.message }, 'Fetch tetikleme hatası');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 4. Tüm Hatalı İşleri Temizle ─────────────────────────────────────────────
queuesRouter.post('/clear-failed', async (_req, res) => {
  try {
    const cleanedCounts: Record<string, number> = {};
    for (const [name, queue] of Object.entries(queueMap)) {
      const removed = await queue.clean(0, 1000, 'failed');
      cleanedCounts[name] = removed.length;
    }

    log.info({ cleanedCounts }, 'Kuyruklardaki hatalı işler temizlendi');
    res.json({
      success: true,
      message: 'Hatalı işler başarıyla temizlendi',
      data: cleanedCounts,
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Hatalı işleri temizleme hatası');
    res.status(500).json({ success: false, error: error.message });
  }
});

