import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

// Connection pool — Railway'de 5, dev'de 3 bağlantı yeterli
const connectionString = env.DATABASE_URL;

const queryClient = postgres(connectionString, {
  max: env.NODE_ENV === 'production' ? 10 : 3,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {}, // Drizzle migration notice'larını sustur
});

export const db = drizzle(queryClient, {
  schema,
  logger: env.NODE_ENV === 'development' && env.LOG_LEVEL === 'debug',
});

export type DB = typeof db;

// Bağlantı sağlık kontrolü
export async function checkDbConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Graceful shutdown için bağlantıyı kapat
export async function closeDb(): Promise<void> {
  await queryClient.end();
}
