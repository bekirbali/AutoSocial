import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../../lib/logger.js';
import { CATEGORY_COLORS, type ArticleCategory } from '../../config/keywords.js';
import { resolveHighResImage } from './downloader.js';

const log = createLogger('processor:carouselGenerator');

export interface CarouselSlideData {
  hook: string;
  summaryTitle?: string; // Dinamik 2-4 kelimelik ara başlık (örn: "40 TFLOPS Güç Geliyor")
  summary: string;
  commentaryTitle?: string; // Dinamik 2-4 kelimelik ara başlık (örn: "Fiyat 50 Bini Aşabilir")
  commentary: string; // Cebe/işe etkisi
  questionTitle?: string; // Dinamik soru başlığı (örn: "Bu Güce Değer mi?")
  question: string;
  sourceName: string;
  category: ArticleCategory;
  articleId: string;
  imageUrl?: string | null;
  articleUrl?: string | null;
}

export interface CarouselResult {
  slidePaths: string[];
  outputDir: string;
}

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 oranı — Instagram feed için en yüksek etkileşimli dikey format

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

/**
 * 1-2 haber olan sakin günlerde derinlemesine 4 slaytlık Instagram Carousel (Kaydırmalı Kart) paketi üretir.
 */
export async function generateNewsCarousel(
  data: CarouselSlideData,
): Promise<CarouselResult> {
  const outputDir = path.join(process.cwd(), 'output', 'carousel', data.articleId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const colors = CATEGORY_COLORS[data.category] || CATEGORY_COLORS.general;

  // Ürün görselini çöz
  let imageBuffer: Buffer | null = null;
  if (data.imageUrl || data.articleUrl) {
    try {
      const resolved = await resolveHighResImage(data.imageUrl, data.articleUrl);
      imageBuffer = resolved.buffer;
    } catch {}
  }

  const slidePaths: string[] = [];

  // Ortak sinematik alt degrade ve yazı gölgesi tanımı
  const commonDefs = `
    <defs>
      <linearGradient id="bottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#020617" stop-opacity="0"/>
        <stop offset="30%" stop-color="#020617" stop-opacity="0.45"/>
        <stop offset="65%" stop-color="#020617" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0.98"/>
      </linearGradient>

      <filter id="textShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.95"/>
      </filter>
    </defs>
  `;

  // Üst navigasyon barı (TeknoFiltre sol üst, sayfa no sağ üst)
  const buildTopBar = (pageNumber: string) => `
    <!-- Sol Üst: TeknoFiltre Minimal Rozeti -->
    <g transform="translate(64, 60)">
      <rect width="180" height="48" rx="24" fill="#0f172a" fill-opacity="0.85" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <circle cx="24" cy="24" r="6" fill="#06b6d4" />
      <text x="40" y="31" font-family="'Segoe UI', Roboto, Arial, sans-serif" font-size="20" font-weight="800" fill="white">TeknoFiltre</text>
    </g>

    <!-- Sağ Üst: Sayfa Numarası -->
    <g transform="translate(${WIDTH - 144}, 60)">
      <rect width="80" height="48" rx="24" fill="#0f172a" fill-opacity="0.75" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <text x="40" y="31" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#94a3b8">${pageNumber}</text>
    </g>
  `;

  const fallbackBg = !imageBuffer ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="${colors.from}"/>` : '';

  // ─── SLAYT 1: Kapak (Ürün Fotoğrafı + Vurucu Kanca - Rozetsiz/Kutucuksuz) ─
  const slide1Path = path.join(outputDir, 'slide_1.jpeg');
  const hookLines = wrapText(escapeXml(data.hook), 22).split('\n');
  const hookYStart = HEIGHT - 130 - hookLines.length * 74;

  const slide1Svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      ${fallbackBg}

      <!-- Sinematik Alt Karartma (Üst kısım %100 net donanım fotoğrafı) -->
      <rect x="0" y="${HEIGHT * 0.46}" width="${WIDTH}" height="${HEIGHT * 0.54}" fill="url(#bottomFade)"/>

      ${buildTopBar('1/4')}

      <!-- Kapak Kancası (Doğrudan görsel üzerine, rozetsiz ve kutusuz) -->
      <g transform="translate(64, ${hookYStart})">
        ${hookLines.map((line, i) =>
          `<text x="0" y="${i * 74}" font-family="'Segoe UI', Roboto, Arial, sans-serif" font-size="58" font-weight="900" fill="white" letter-spacing="-1" filter="url(#textShadow)">${line}</text>`
        ).join('')}
      </g>

      <!-- Kaydır İpucu (Sağ Alt) -->
      <g transform="translate(${WIDTH - 240}, ${HEIGHT - 80})">
        <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#cbd5e1" filter="url(#textShadow)">Kaydırın ➔</text>
      </g>
    </svg>
  `;

  let s1Sharp = imageBuffer
    ? sharp(imageBuffer)
        .resize(WIDTH, HEIGHT, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 })
        .composite([{ input: Buffer.from(slide1Svg) }])
    : sharp(Buffer.from(slide1Svg));
  await s1Sharp.jpeg({ quality: 92 }).toFile(slide1Path);
  slidePaths.push(slide1Path);

  const summaryTitle = data.summaryTitle || 'İşin Özü';
  const commentaryTitle = data.commentaryTitle || 'Bizim Yorumumuz';
  const questionTitle = data.questionTitle || 'Sence Değer mi?';

  // ─── SLAYT 2: Olay Ne? -> Dinamik Başlık (Kutucuksuz / Doğrudan Görsel Üzerine Tipografi) ────
  const slide2Path = path.join(outputDir, 'slide_2.jpeg');
  const summaryLines = wrapText(escapeXml(data.summary), 26).split('\n');
  const s2ContentYStart = HEIGHT - 150 - (summaryLines.length * 54 + 80);

  const slide2Svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      ${fallbackBg}

      <!-- Sinematik Alt Karartma (Ürün görseli görünür kalır) -->
      <rect x="0" y="${HEIGHT * 0.40}" width="${WIDTH}" height="${HEIGHT * 0.60}" fill="url(#bottomFade)"/>

      ${buildTopBar('2/4')}

      <!-- Başlık ve Metin (Kare kutucuk olmadan, doğrudan degrade üzerine) -->
      <g transform="translate(64, ${s2ContentYStart})">
        <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="white" filter="url(#textShadow)">${escapeXml(summaryTitle)}</text>
        <rect x="0" y="16" width="60" height="5" rx="2.5" fill="#06b6d4" />

        <g transform="translate(0, 68)">
          ${summaryLines.map((line, i) =>
            `<text x="0" y="${i * 54}" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9" letter-spacing="-0.3" filter="url(#textShadow)">${line}</text>`
          ).join('')}
        </g>
      </g>

      <text x="${WIDTH - 240}" y="${HEIGHT - 80}" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#cbd5e1" filter="url(#textShadow)">Kaydırın ➔</text>
    </svg>
  `;

  let s2Sharp = imageBuffer
    ? sharp(imageBuffer)
        .resize(WIDTH, HEIGHT, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 })
        .composite([{ input: Buffer.from(slide2Svg) }])
    : sharp(Buffer.from(slide2Svg));
  await s2Sharp.jpeg({ quality: 92 }).toFile(slide2Path);
  slidePaths.push(slide2Path);

  // ─── SLAYT 3: Cebe Etkisi -> Dinamik Başlık (Kutucuksuz / Rozetsiz) ─────────
  const slide3Path = path.join(outputDir, 'slide_3.jpeg');
  const commentaryLines = wrapText(escapeXml(data.commentary), 26).split('\n');
  const s3ContentYStart = HEIGHT - 150 - (commentaryLines.length * 54 + 80);

  const slide3Svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      ${fallbackBg}

      <rect x="0" y="${HEIGHT * 0.40}" width="${WIDTH}" height="${HEIGHT * 0.60}" fill="url(#bottomFade)"/>

      ${buildTopBar('3/4')}

      <g transform="translate(64, ${s3ContentYStart})">
        <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="white" filter="url(#textShadow)">${escapeXml(commentaryTitle)}</text>
        <rect x="0" y="16" width="60" height="5" rx="2.5" fill="#10b981" />

        <g transform="translate(0, 68)">
          ${commentaryLines.map((line, i) =>
            `<text x="0" y="${i * 54}" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9" letter-spacing="-0.3" filter="url(#textShadow)">${line}</text>`
          ).join('')}
        </g>
      </g>

      <text x="${WIDTH - 240}" y="${HEIGHT - 80}" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#cbd5e1" filter="url(#textShadow)">Kaydırın ➔</text>
    </svg>
  `;

  let s3Sharp = imageBuffer
    ? sharp(imageBuffer)
        .resize(WIDTH, HEIGHT, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 })
        .composite([{ input: Buffer.from(slide3Svg) }])
    : sharp(Buffer.from(slide3Svg));
  await s3Sharp.jpeg({ quality: 92 }).toFile(slide3Path);
  slidePaths.push(slide3Path);

  // ─── SLAYT 4: Tartışma & Takip (Dinamik Soru Başlığı / Kutucuksuz) ──────────
  const slide4Path = path.join(outputDir, 'slide_4.jpeg');
  const questionLines = wrapText(escapeXml(data.question), 24).split('\n');
  const s4ContentYStart = HEIGHT - 220 - (questionLines.length * 60 + 80);

  const slide4Svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      ${fallbackBg}

      <rect x="0" y="${HEIGHT * 0.40}" width="${WIDTH}" height="${HEIGHT * 0.60}" fill="url(#bottomFade)"/>

      ${buildTopBar('4/4')}

      <!-- Soru Başlığı ve Sorusu -->
      <g transform="translate(64, ${s4ContentYStart})">
        <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="white" filter="url(#textShadow)">${escapeXml(questionTitle)}</text>
        <rect x="0" y="16" width="60" height="5" rx="2.5" fill="#06b6d4" />

        <g transform="translate(0, 68)">
          ${questionLines.map((line, i) =>
            `<text x="0" y="${i * 60}" font-family="'Segoe UI', Roboto, sans-serif" font-size="40" font-weight="800" fill="#f1f5f9" filter="url(#textShadow)">${line}</text>`
          ).join('')}
        </g>
      </g>

      <!-- Minimal Takip Butonu ve Bilgi (Kare kutu değil, şık floating pill) -->
      <g transform="translate(64, ${HEIGHT - 130})">
        <rect width="250" height="52" rx="26" fill="#06b6d4"/>
        <text x="125" y="33" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="800" fill="#020617">@teknofiltre Takip Et</text>
        <text x="280" y="33" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="#94a3b8" filter="url(#textShadow)">Küratör Teknoloji</text>
      </g>
    </svg>
  `;

  let s4Sharp = imageBuffer
    ? sharp(imageBuffer)
        .resize(WIDTH, HEIGHT, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 })
        .composite([{ input: Buffer.from(slide4Svg) }])
    : sharp(Buffer.from(slide4Svg));
  await s4Sharp.jpeg({ quality: 92 }).toFile(slide4Path);
  slidePaths.push(slide4Path);

  log.info({ articleId: data.articleId, slideCount: slidePaths.length }, '✅ 4 Slaytlık Instagram Carousel üretildi');

  return {
    slidePaths,
    outputDir,
  };
}
