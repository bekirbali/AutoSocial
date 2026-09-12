import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { existsSync, statSync, createReadStream } from 'fs';
import { createLogger } from '../lib/logger.js';
import { overviewRouter } from './routes/overview.js';
import { articlesRouter } from './routes/articles.js';
import { digestRouter } from './routes/digest.js';
import { queuesRouter } from './routes/queues.js';
import { settingsRouter } from './routes/settings.js';

const log = createLogger('server:app');

export function createAdminApp(): express.Application {
  const app = express();

  // 1. Temel Ara Yazılımlar
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 2. Medya Sunucusu (/images ve /videos) - Instagram Graph API & Cloudflare Tunnel Uyumluluğu
  const imagesDir = join(process.cwd(), 'output', 'images');
  const videosDir = join(process.cwd(), 'output', 'videos');

  app.use('/images', express.static(imagesDir, {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  }));

  app.use('/videos', express.static(videosDir, {
    acceptRanges: true,
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Accept-Ranges', 'bytes');
    },
  }));

  // 3. Admin REST API Rotaları
  app.use('/api/admin/overview', overviewRouter);
  app.use('/api/admin/articles', articlesRouter);
  app.use('/api/admin/digest', digestRouter);
  app.use('/api/admin/queues', queuesRouter);
  app.use('/api/admin/settings', settingsRouter);

  // 4. Frontend SPA (Vite React Build)
  const clientDist = join(process.cwd(), 'client', 'dist');
  app.use('/admin', express.static(clientDist));
  app.get('/admin', (_req, res) => {
    if (existsSync(join(clientDist, 'index.html'))) {
      res.sendFile(join(clientDist, 'index.html'));
    } else {
      res.status(503).send('Admin paneli derleniyor, lütfen bekleyin...');
    }
  });
  app.get('/admin/{*splat}', (_req, res) => {
    if (existsSync(join(clientDist, 'index.html'))) {
      res.sendFile(join(clientDist, 'index.html'));
    } else {
      res.status(503).send('Admin paneli derleniyor, lütfen bekleyin...');
    }
  });

  // Kök dizin -> /admin'e yönlendir
  app.get('/', (_req, res) => {
    res.redirect('/admin');
  });

  return app;
}
