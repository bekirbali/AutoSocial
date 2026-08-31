import sharp from 'sharp';
import { createLogger } from '../../lib/logger.js';
import { CATEGORY_COLORS, type ArticleCategory } from '../../config/keywords.js';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const log = createLogger('processor:image');

// Çıktı boyutu — Twitter card için optimal
const WIDTH = 1200;
const HEIGHT = 675;

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
): Promise<ImageGenerationResult> {
  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const imagePath = path.join(OUTPUT_DIR, `${articleId}.webp`);
  const colors = CATEGORY_COLORS[category];

  // Gradient arka plan SVG
  const gradientSvg = buildGradientSvg(colors.from, colors.to, title, sourceName, category, publishedAt);

  await sharp(Buffer.from(gradientSvg))
    .resize(WIDTH, HEIGHT)
    .webp({ quality: 85 })
    .toFile(imagePath);

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
): string {
  const safeTitle = escapeXml(wrapText(title, 45));
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
  const titleYStart = 480 - titleLines.length * 40;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="60" y="${titleYStart + i * 48}" font-family="'Segoe UI', Arial, sans-serif" font-size="36" font-weight="700" fill="white" letter-spacing="-0.5">${line}</text>`,
    )
    .join('\n');

  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
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
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />

  <!-- Dekoratif desen — subtle grid lines -->
  <line x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}" stroke="white" stroke-opacity="0.03" stroke-width="1"/>
  <line x1="${WIDTH}" y1="0" x2="0" y2="${HEIGHT}" stroke="white" stroke-opacity="0.03" stroke-width="1"/>
  <circle cx="${WIDTH * 0.8}" cy="${HEIGHT * 0.2}" r="200" fill="white" fill-opacity="0.03"/>
  <circle cx="${WIDTH * 0.1}" cy="${HEIGHT * 0.8}" r="150" fill="white" fill-opacity="0.02"/>

  <!-- Overlay gradient (alt karartma) -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#overlay)" />

  <!-- Sol kenar vurgu çizgisi -->
  <rect x="0" y="0" width="5" height="${HEIGHT}" fill="white" fill-opacity="0.8" />

  <!-- Kaynak etiketi (sol üst) -->
  <rect x="24" y="24" width="${Math.min(safeSource.length * 11 + 30, 300)}" height="42" rx="8" fill="white" fill-opacity="0.15" />
  <text x="40" y="52" font-family="'Segoe UI', Arial, sans-serif" font-size="18" font-weight="600" fill="white">${safeSource}</text>

  <!-- Kategori etiketi (sağ üst) - İptal edildi
  <rect x="${WIDTH - 200}" y="24" width="178" height="42" rx="8" fill="white" fill-opacity="0.15" />
  <text x="${WIDTH - 110}" y="52" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="15" font-weight="600" fill="#a0a0a0">${safeCategory}</text>
  -->

  <!-- Haber başlığı (alt orta) -->
  ${titleSvg}

  <!-- Alt bilgi çubuğu -->
  <rect x="0" y="${HEIGHT - 55}" width="${WIDTH}" height="55" fill="black" fill-opacity="0.5" />

  <!-- Tarih (alt sol) -->
  <text x="24" y="${HEIGHT - 22}" font-family="'Segoe UI', Arial, sans-serif" font-size="16" fill="#8a8a8a">${safeDateStr}</text>

  <!-- DonanımPost brand (alt sağ) -->
  <text x="${WIDTH - 24}" y="${HEIGHT - 22}" text-anchor="end" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="600" fill="#4a4a4a">DonanımPost</text>
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
