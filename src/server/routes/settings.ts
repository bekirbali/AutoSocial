import { Router } from 'express';
import { SOURCES } from '../../config/sources.js';
import { NICHE_KEYWORDS } from '../../config/keywords.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('server:routes:settings');
export const settingsRouter: Router = Router();

settingsRouter.get('/', async (_req, res): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        sources: SOURCES,
        categories: Object.keys(NICHE_KEYWORDS),
        keywords: NICHE_KEYWORDS,
        env: {
          appMode: env.APP_MODE,
          maxTweetsPerDay: env.MAX_TWEETS_PER_DAY,
          fetchIntervalMinutes: env.FETCH_INTERVAL_MINUTES,
          enableInstagram: env.ENABLE_INSTAGRAM,
          publicUrl: env.APP_PUBLIC_URL || 'http://localhost:3000',
          minScoreThreshold: env.MIN_SCORE_THRESHOLD,
        },
      },
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Ayarlar getirilemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});
