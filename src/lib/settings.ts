import { redis } from './redis.js';
import { env } from '../config/env.js';
import { createLogger } from './logger.js';

const log = createLogger('lib:settings');

export interface DynamicSettings {
  maxTweetsPerDay: number;
  minScoreThreshold: number;
  telegramMinScore: number;
  fetchIntervalMinutes: number;
  analyticsFetchIntervalHours: number;
  appMode: 'hybrid' | 'automatic';
  enableInstagram: boolean;
  xManualMode: boolean;
  defaultGeminiModel: 'gemini-3.6-flash' | 'gemini-3.5-flash' | 'gemini-3.5-flash-lite';
}

const SETTING_PREFIX = 'setting:';

/**
 * Redis üzerinden dinamik bir ayarı oku, yoksa varsayılan değere dön
 */
export async function getDynamicSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await redis.get(`${SETTING_PREFIX}${key}`);
    if (val === null || val === undefined) {
      return defaultValue;
    }

    if (typeof defaultValue === 'number') {
      const num = Number(val);
      return (isNaN(num) ? defaultValue : num) as T;
    }

    if (typeof defaultValue === 'boolean') {
      return (val === 'true' || val === '1') as T;
    }

    return val as T;
  } catch (err: any) {
    log.warn({ key, err: err.message }, 'Redis ayarı okunamadı, varsayılana dönülüyor');
    return defaultValue;
  }
}

/**
 * Redis üzerine dinamik bir ayarı yaz
 */
export async function setDynamicSetting(key: string, value: any): Promise<void> {
  try {
    await redis.set(`${SETTING_PREFIX}${key}`, String(value));
    log.info({ key, value }, 'Dinamik sistem ayarı güncellendi');
  } catch (err: any) {
    log.error({ key, err: err.message }, 'Dinamik ayar Redis\'e yazılamadı');
    throw err;
  }
}

/**
 * Tüm dinamik ayarları tek seferde getir (Admin Panel için)
 */
export async function getAllDynamicSettings(): Promise<DynamicSettings> {
  const [
    maxTweetsPerDay,
    minScoreThreshold,
    telegramMinScore,
    fetchIntervalMinutes,
    analyticsFetchIntervalHours,
    appMode,
    enableInstagram,
    xManualMode,
    defaultGeminiModel,
  ] = await Promise.all([
    getDynamicSetting('max_tweets_per_day', env.MAX_TWEETS_PER_DAY),
    getDynamicSetting('min_score_threshold', env.MIN_SCORE_THRESHOLD),
    getDynamicSetting('telegram_min_score', 85),
    getDynamicSetting('fetch_interval_minutes', env.FETCH_INTERVAL_MINUTES),
    getDynamicSetting('analytics_fetch_interval_hours', env.ANALYTICS_FETCH_INTERVAL_HOURS),
    getDynamicSetting<'hybrid' | 'automatic'>('app_mode', env.APP_MODE),
    getDynamicSetting('enable_instagram', env.ENABLE_INSTAGRAM),
    getDynamicSetting('x_manual_mode', env.X_MANUAL_MODE ?? false),
    getDynamicSetting<'gemini-3.6-flash' | 'gemini-3.5-flash' | 'gemini-3.5-flash-lite'>(
      'default_gemini_model',
      'gemini-3.6-flash',
    ),
  ]);

  return {
    maxTweetsPerDay,
    minScoreThreshold,
    telegramMinScore,
    fetchIntervalMinutes,
    analyticsFetchIntervalHours,
    appMode,
    enableInstagram,
    xManualMode,
    defaultGeminiModel,
  };
}

/**
 * Toplu ayar güncellemesi yap
 */
export async function updateDynamicSettings(settings: Partial<DynamicSettings>): Promise<DynamicSettings> {
  const promises: Promise<void>[] = [];

  if (settings.maxTweetsPerDay !== undefined) {
    promises.push(setDynamicSetting('max_tweets_per_day', Math.max(1, Math.min(50, settings.maxTweetsPerDay))));
  }
  if (settings.minScoreThreshold !== undefined) {
    promises.push(setDynamicSetting('min_score_threshold', Math.max(0, Math.min(100, settings.minScoreThreshold))));
  }
  if (settings.telegramMinScore !== undefined) {
    promises.push(setDynamicSetting('telegram_min_score', Math.max(0, Math.min(100, settings.telegramMinScore))));
  }
  if (settings.fetchIntervalMinutes !== undefined) {
    promises.push(setDynamicSetting('fetch_interval_minutes', Math.max(5, settings.fetchIntervalMinutes)));
  }
  if (settings.analyticsFetchIntervalHours !== undefined) {
    promises.push(setDynamicSetting('analytics_fetch_interval_hours', Math.max(1, settings.analyticsFetchIntervalHours)));
  }
  if (settings.appMode !== undefined) {
    promises.push(setDynamicSetting('app_mode', settings.appMode));
  }
  if (settings.enableInstagram !== undefined) {
    promises.push(setDynamicSetting('enable_instagram', settings.enableInstagram));
  }
  if (settings.xManualMode !== undefined) {
    promises.push(setDynamicSetting('x_manual_mode', settings.xManualMode));
  }
  if (settings.defaultGeminiModel !== undefined) {
    promises.push(setDynamicSetting('default_gemini_model', settings.defaultGeminiModel));
  }

  await Promise.all(promises);
  return getAllDynamicSettings();
}
