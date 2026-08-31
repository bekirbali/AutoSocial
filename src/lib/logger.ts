import pino from 'pino';
import { env } from '../config/env.js';

// Dev'de pino-pretty ile renkli/okunabilir çıktı
// Prod'da JSON formatında yapılandırılmış log
const transport =
  env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    base: {
      service: 'autosocial',
      env: env.NODE_ENV,
    },
  },
  transport ? pino.transport(transport) : undefined,
);

// Modül bazlı child logger factory
export function createLogger(module: string) {
  return logger.child({ module });
}

export type Logger = ReturnType<typeof createLogger>;
