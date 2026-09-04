import sharp from 'sharp';
import { createLogger } from '../../lib/logger.js';
import { CATEGORY_COLORS, type ArticleCategory } from '../../config/keywords.js';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const log = createLogger('processor:image');

// Çıktı boyutu — Varsayılan (Twitter/X için)
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 675;

export type ImageFormat = '16:9' | '4:5';

// Görsel çıktı klasörü
const OUTPUT_DIR = './output/images';

export interface ImageGenerationResult {
  imagePath: string;
  imageSource: 'template';
}

/**
 * Sharp ile kategori rengine göre gradient arka planlı haber kartı üret
 *
 * Layout:
 * ┌─────────────────────────────┐
 * │  [Gradient Arka Plan]       │
 * │  [Sol üst: Kaynak]          │
 * │  [Orta: Kategori etiketi]   │
 * │  [Alt: Başlık - beyaz bold] │
 * │  [Alt bar: Tarih + kaynak]  │
 * └─────────────────────────────┘
 */
export async function generateNewsCard(
  title: string,
  sourceName: string,
  category: ArticleCategory,
  publishedAt: Date,
  articleId: string,
  format: ImageFormat = '16:9',
): Promise<ImageGenerationResult> {
  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const width = format === '4:5' ? 1080 : 1200;
  const height = format === '4:5' ? 1350 : 675;
  const ext = 'jpeg'; // Instagram API sadece JPEG kabul ediyor, uyumluluk için her formatta JPEG kullanıyoruz.

  const imagePath = path.join(OUTPUT_DIR, `${articleId}_${format.replace(':', 'x')}.${ext}`);
  const colors = CATEGORY_COLORS[category];

  // Gradient arka plan SVG
  const gradientSvg = buildGradientSvg(colors.from, colors.to, title, sourceName, category, publishedAt, width, height, format);

  const sharpInstance = sharp(Buffer.from(gradientSvg)).resize(width, height);
  
  await sharpInstance.jpeg({ quality: 90 }).toFile(imagePath);

  log.debug({ articleId, category, imagePath }, 'Görsel üretildi');

  return { imagePath, imageSource: 'template' };
}

/**
 * SVG tabanlı görsel template üret
 */
function buildGradientSvg(
  fromColor: string,
  toColor: string,
  title: string,
  sourceName: string,
  category: ArticleCategory,
  publishedAt: Date,
  width: number,
  height: number,
  format: ImageFormat,
): string {
  const charsPerLine = format === '4:5' ? 35 : 45;
  const safeTitle = escapeXml(wrapText(title, charsPerLine));
  const safeSource = escapeXml(sourceName);
  const safeCategory = escapeXml(categoryLabel(category));
  const dateStr = publishedAt.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const safeDateStr = escapeXml(dateStr);

  // Başlığı satırlara böl
  const titleLines = safeTitle.split('\n');
  
  const titleFontSize = format === '4:5' ? 52 : 36;
  const titleLineHeight = format === '4:5' ? 68 : 48;
  const titleBaseY = format === '4:5' ? height - 150 : height - 195;
  const titleYStart = titleBaseY - titleLines.length * titleLineHeight;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${format === '4:5' ? 80 : 60}" y="${titleYStart + i * titleLineHeight}" font-family="'Segoe UI', Arial, sans-serif" font-size="${titleFontSize}" font-weight="700" fill="white" letter-spacing="-0.5">${line}</text>`,
    )
    .join('\n');

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${fromColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${toColor};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:transparent;stop-opacity:0" />
      <stop offset="60%" style="stop-color:#000000;stop-opacity:0.7" />
      <stop offset="100%" style="stop-color:#000000;stop-opacity:0.9" />
    </linearGradient>
  </defs>

  <!-- Arka plan gradient -->
  <rect width="${width}" height="${height}" fill="url(#bg)" />

  <!-- Dekoratif desen — subtle grid lines -->
  <line x1="0" y1="0" x2="${width}" y2="${height}" stroke="white" stroke-opacity="0.03" stroke-width="1"/>
  <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="white" stroke-opacity="0.03" stroke-width="1"/>
  <circle cx="${width * 0.8}" cy="${height * 0.2}" r="${format === '4:5' ? 300 : 200}" fill="white" fill-opacity="0.03"/>
  <circle cx="${width * 0.1}" cy="${height * 0.8}" r="${format === '4:5' ? 250 : 150}" fill="white" fill-opacity="0.02"/>

  <!-- Overlay gradient (alt karartma) -->
  <rect width="${width}" height="${height}" fill="url(#overlay)" />

  <!-- Sol kenar vurgu çizgisi -->
  <rect x="0" y="0" width="${format === '4:5' ? 8 : 5}" height="${height}" fill="white" fill-opacity="0.8" />

  <!-- Kaynak etiketi (sol üst) -->
  <rect x="${format === '4:5' ? 36 : 24}" y="${format === '4:5' ? 36 : 24}" width="${Math.min(safeSource.length * (format === '4:5' ? 16 : 11) + 40, 400)}" height="${format === '4:5' ? 54 : 42}" rx="8" fill="white" fill-opacity="0.15" />
  <text x="${format === '4:5' ? 56 : 40}" y="${format === '4:5' ? 72 : 52}" font-family="'Segoe UI', Arial, sans-serif" font-size="${format === '4:5' ? 24 : 18}" font-weight="600" fill="white">${safeSource}</text>

  <!-- Haber başlığı (alt orta) -->
  ${titleSvg}

  <!-- Alt bilgi çubuğu -->
  <rect x="0" y="${height - (format === '4:5' ? 80 : 55)}" width="${width}" height="${format === '4:5' ? 80 : 55}" fill="black" fill-opacity="0.5" />

  <!-- Tarih (alt sol) -->
  <text x="${format === '4:5' ? 36 : 24}" y="${height - (format === '4:5' ? 32 : 22)}" font-family="'Segoe UI', Arial, sans-serif" font-size="${format === '4:5' ? 22 : 16}" fill="#8a8a8a">${safeDateStr}</text>

  <!-- DonanımPost brand (alt sağ) -->
  <text x="${width - (format === '4:5' ? 36 : 24)}" y="${height - (format === '4:5' ? 32 : 22)}" text-anchor="end" font-family="'Segoe UI', Arial, sans-serif" font-size="${format === '4:5' ? 24 : 16}" font-weight="600" fill="#4a4a4a">DonanımPost</text>
</svg>`;
}

/**
 * Türkçe kategori etiketi
 */
function categoryLabel(category: ArticleCategory): string {
  const labels: Record<ArticleCategory, string> = {
    cpu: 'İŞLEMCİ',
    gpu: 'EKRAN KARTI',
    ram: 'BELLEK',
    storage: 'DEPOLAMA',
    motherboard: 'ANAKART',
    cooling: 'SOĞUTMA',
    peripherals: 'ÇEVRE BİRİMLERİ',
    psu: 'GÜÇ KAYNAĞI',
    case: 'KASA',
    gaming: 'OYUN',
    deals: '🔥 FIRSAT',
    software: 'YAZILIM',
    general: 'DONANIM',
  };
  return labels[category] ?? 'DONANIM';
}

/**
 * Uzun metni belirli karakter genişliğinde satırlara böl
 */
function wrapText(text: string, charsPerLine: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= charsPerLine) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  return lines.slice(0, 3).join('\n'); // Max 3 satır
}

/**
 * XML özel karakterleri escape et
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
