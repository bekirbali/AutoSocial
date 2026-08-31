import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { createLogger } from './logger.js';

const log = createLogger('redis');

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 500, 5000);
    log.warn({ attempt: times, delayMs: delay }, 'Redis bağlantısı yeniden deneniyor');
    return delay;
  },
});

redis.on('connect', () => log.info('Redis bağlandı'));
redis.on('error', (err) => log.error({ err }, 'Redis hatası'));
redis.on('close', () => log.warn('Redis bağlantısı kapandı'));

export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
