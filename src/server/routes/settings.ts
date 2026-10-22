import { Router } from 'express';
import { SOURCES } from '../../config/sources.js';
import { NICHE_KEYWORDS } from '../../config/keywords.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';

import { isXManualMode, setXManualMode } from '../../modules/publisher/twitter.js';

import { getAllDynamicSettings, updateDynamicSettings } from '../../lib/settings.js';

const log = createLogger('server:routes:settings');
export const settingsRouter: Router = Router();

settingsRouter.get('/', async (_req, res): Promise<void> => {
  try {
    const dynamicSettings = await getAllDynamicSettings();
    res.json({
      success: true,
      data: {
        sources: SOURCES,
        categories: Object.keys(NICHE_KEYWORDS),
        keywords: NICHE_KEYWORDS,
        xManualMode: dynamicSettings.xManualMode,
        settings: dynamicSettings,
        env: {
          appMode: dynamicSettings.appMode,
          maxTweetsPerDay: dynamicSettings.maxTweetsPerDay,
          fetchIntervalMinutes: dynamicSettings.fetchIntervalMinutes,
          enableInstagram: dynamicSettings.enableInstagram,
          publicUrl: env.APP_PUBLIC_URL || 'http://localhost:3000',
          minScoreThreshold: dynamicSettings.minScoreThreshold,
          xManualMode: dynamicSettings.xManualMode,
          defaultGeminiModel: dynamicSettings.defaultGeminiModel,
        },
      },
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Ayarlar getirilemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Dinamik sistem ayarlarını güncelle
 * Body: Partial<DynamicSettings>
 */
settingsRouter.post('/', async (req, res): Promise<void> => {
  try {
    const updated = await updateDynamicSettings(req.body);
    res.json({
      success: true,
      message: 'Sistem ayarları başarıyla güncellendi',
      settings: updated,
    });
  } catch (error: any) {
    log.error({ err: error.message }, 'Sistem ayarları güncellenemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * X Manuel Modunu aç / kapat
 * Body: { enabled: boolean }
 */
settingsRouter.post('/x-manual-mode', async (req, res): Promise<void> => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'enabled boolean olmalıdır (true veya false)' });
      return;
    }

    await setXManualMode(enabled);
    res.json({ success: true, xManualMode: enabled, message: enabled ? 'X Manuel Modu aktif edildi (API pasif)' : 'X Otomatik Modu aktif edildi (API aktif)' });
  } catch (error: any) {
    log.error({ err: error.message }, 'Manuel mod güncellenemedi');
    res.status(500).json({ success: false, error: error.message });
  }
});

