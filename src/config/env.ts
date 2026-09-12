import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  // Uygulama
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  APP_MODE: z.enum(['hybrid', 'automatic']).default('hybrid'),

  // Veritabanı
  DATABASE_URL: z.string().url('DATABASE_URL geçerli bir PostgreSQL URL olmalı'),
  REDIS_URL: z.string().url('REDIS_URL geçerli bir Redis URL olmalı'),

  // X (Twitter) API
  X_CONSUMER_KEY: z.string().min(1, 'X_CONSUMER_KEY gerekli'),
  X_CONSUMER_KEY_SECRET: z.string().min(1, 'X_CONSUMER_KEY_SECRET gerekli'),
  X_ACCESS_TOKEN: z.string().min(1, 'X_ACCESS_TOKEN gerekli'),
  X_ACCESS_TOKEN_SECRET: z.string().min(1, 'X_ACCESS_TOKEN_SECRET gerekli'),
  X_BEARER_TOKEN: z.string().min(1, 'X_BEARER_TOKEN gerekli'),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),

  // Gemini AI
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY gerekli'),

  // Telegram (Faz 3'te zorunlu hale gelecek)
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token gerekli'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'Telegram chat ID (kanal/grup) gerekli'),

  // Instagram Graph API
  ENABLE_INSTAGRAM: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  IG_ACCESS_TOKEN: z.string().optional(),
  IG_ACCOUNT_ID: z.string().optional(),

  // Public URL (Instagram'ın görselleri çekebilmesi için uygulamanın erişilebilir URL'si)
  // Geliştirme ortamında ngrok vb. olabilir, production'da Railway domain'i.
  APP_PUBLIC_URL: z.string().url('Geçerli bir APP_PUBLIC_URL girin').optional(),

  // Sistem Ayarları
  MAX_TWEETS_PER_DAY: z.coerce.number().int().min(1).max(50).default(15),
  MIN_TWEETS_PER_DAY: z.coerce.number().int().min(1).default(8),
  MIN_SCORE_THRESHOLD: z.coerce.number().min(0).max(100).default(90),
  FETCH_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(15),
  ANALYTICS_FETCH_INTERVAL_HOURS: z.coerce.number().int().min(1).default(6),

  // Tweet dili
  TWEET_LANG: z.enum(['tr', 'en']).default('tr'),
});

function parseEnv() {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Geçersiz environment variable konfigürasyonu:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
