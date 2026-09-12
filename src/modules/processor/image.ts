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

export type ImageFormat = '16:9' | '4:5' | '9:16';

// Görsel çıktı klasörü
const OUTPUT_DIR = './output/images';

import { downloadImage } from './downloader.js';

export interface ImageGenerationResult {
  imagePath: string;
  imageSource: 'template' | 'external';
}

/**
 * Sharp ile haber kartı üret.
 * Görsel URL verilmişse indirip arkaplan olarak kullanır. Yoksa gradient kullanır.
 */
export async function generateNewsCard(
  title: string,
  sourceName: string,
  category: ArticleCategory,
  publishedAt: Date,
  articleId: string,
  format: ImageFormat = '16:9',
  imageUrl?: string | null,
): Promise<ImageGenerationResult> {
  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const width = format === '16:9' ? 1200 : 1080;
  const height = format === '9:16' ? 1920 : format === '4:5' ? 1350 : 675;
  const ext = 'jpeg'; // Instagram API sadece JPEG kabul ediyor

  const imagePath = path.join(OUTPUT_DIR, `${articleId}_${format.replace(':', 'x')}.${ext}`);
  const colors = CATEGORY_COLORS[category];

  let downloadedImageBuffer: Buffer | null = null;
  if (imageUrl) {
    downloadedImageBuffer = await downloadImage(imageUrl);
  }

  // 9:16 Instagram Reels için özel profesyonel kompozisyon
  if (format === '9:16') {
    if (downloadedImageBuffer) {
      // 1. Ambiyans arka planı (1080x1920 blur + hafif karartma)
      const bgBuffer = await sharp(downloadedImageBuffer)
        .resize(width, height, { fit: 'cover' })
        .blur(30)
        .modulate({ brightness: 0.45 })
        .toBuffer();

      // 2. Ön plandaki 16:9 fotoğraf (yuvarlatılmış köşeli, tam oranında kesilmeden)
      const fgWidth = 960;
      const fgHeight = 540;
      const roundedCornerSvg = Buffer.from(
        `<svg><rect x="0" y="0" width="${fgWidth}" height="${fgHeight}" rx="24" ry="24"/></svg>`
      );
      const fgBuffer = await sharp(downloadedImageBuffer)
        .resize(fgWidth, fgHeight, { fit: 'cover' })
        .composite([{ input: roundedCornerSvg, blend: 'dest-in' }])
        .png()
        .toBuffer();

      // 3. Reels SVG Metin ve Arayüz Katmanı (Merkez Safe Zone)
      const overlaySvg = buildReelsOverlaySvg(title, sourceName, publishedAt, width, height, colors.from, 350, fgHeight);

      await sharp(bgBuffer)
        .composite([
          { input: fgBuffer, top: 350, left: 60 },
          { input: Buffer.from(overlaySvg), top: 0, left: 0 },
        ])
        .jpeg({ quality: 92 })
        .toFile(imagePath);
    } else {
      // Görsel yoksa şık gradient kart (yine merkez safe zone)
      const overlaySvg = buildReelsTemplateSvg(title, sourceName, publishedAt, width, height, colors.from, colors.to);
      await sharp(Buffer.from(overlaySvg))
        .resize(width, height)
        .jpeg({ quality: 92 })
        .toFile(imagePath);
    }

    log.debug({ articleId, category, imagePath, hasExternalImage: !!downloadedImageBuffer }, '9:16 Reels görseli üretildi');
    return { imagePath, imageSource: downloadedImageBuffer ? 'external' : 'template' };
  }

  // 16:9 (X/Twitter) ve 4:5 formatları için standart üretim
  const transparentBg = downloadedImageBuffer !== null;
  const overlaySvg = buildGradientSvg(colors.from, colors.to, title, sourceName, category, publishedAt, width, height, format, transparentBg);

  let sharpInstance;
  if (downloadedImageBuffer) {
    sharpInstance = sharp(downloadedImageBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([{ input: Buffer.from(overlaySvg), gravity: 'center' }]);
  } else {
    sharpInstance = sharp(Buffer.from(overlaySvg)).resize(width, height);
  }

  await sharpInstance.jpeg({ quality: 90 }).toFile(imagePath);
  log.debug({ articleId, category, imagePath, hasExternalImage: !!downloadedImageBuffer }, 'Görsel üretildi');

  return { imagePath, imageSource: downloadedImageBuffer ? 'external' : 'template' };
}

export interface DigestSlideParams {
  title: string;
  sourceName: string;
  category: ArticleCategory;
  publishedAt: Date;
  articleId: string;
  imageUrl?: string | null;
  slideIndex: number;
  totalSlides: number;
  digestType: 'noon' | 'evening' | 'manual';
}

/**
 * Günlük bülten (digest) için numaralandırılmış 9:16 dikey kart üretir.
 */
export async function generateDigestSlideCard(
  params: DigestSlideParams,
): Promise<string> {
  const {
    title,
    sourceName,
    category,
    publishedAt,
    articleId,
    imageUrl,
    slideIndex,
    totalSlides,
    digestType,
  } = params;

  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const width = 1080;
  const height = 1920;
  const imagePath = path.join(
    OUTPUT_DIR,
    `digest_${articleId}_${slideIndex}_of_${totalSlides}.jpeg`,
  );

  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general;
  let downloadedImageBuffer: Buffer | null = null;
  if (imageUrl) {
    downloadedImageBuffer = await downloadImage(imageUrl);
  }

  const badgePrefix =
    digestType === 'noon'
      ? 'ÖĞLE BÜLTENİ'
      : digestType === 'evening'
      ? 'AKŞAM BÜLTENİ'
      : 'GÜNÜN ÖZETİ';
  const badgeText = `${badgePrefix} • ${slideIndex}/${totalSlides}`;

  if (downloadedImageBuffer) {
    const bgBuffer = await sharp(downloadedImageBuffer)
      .resize(width, height, { fit: 'cover' })
      .blur(30)
      .modulate({ brightness: 0.45 })
      .toBuffer();

    const fgWidth = 960;
    const fgHeight = 540;
    const roundedCornerSvg = Buffer.from(
      `<svg><rect x="0" y="0" width="${fgWidth}" height="${fgHeight}" rx="24" ry="24"/></svg>`,
    );
    const fgBuffer = await sharp(downloadedImageBuffer)
      .resize(fgWidth, fgHeight, { fit: 'cover' })
      .composite([{ input: roundedCornerSvg, blend: 'dest-in' }])
      .png()
      .toBuffer();

    const overlaySvg = buildReelsOverlaySvg(
      title,
      sourceName,
      publishedAt,
      width,
      height,
      colors.from,
      350,
      fgHeight,
      badgeText,
    );

    await sharp(bgBuffer)
      .composite([
        { input: fgBuffer, top: 350, left: 60 },
        { input: Buffer.from(overlaySvg), top: 0, left: 0 },
      ])
      .jpeg({ quality: 92 })
      .toFile(imagePath);
  } else {
    const overlaySvg = buildReelsTemplateSvg(
      title,
      sourceName,
      publishedAt,
      width,
      height,
      colors.from,
      colors.to,
      badgeText,
    );
    await sharp(Buffer.from(overlaySvg))
      .resize(width, height)
      .jpeg({ quality: 92 })
      .toFile(imagePath);
  }

  log.debug({ articleId, slideIndex, totalSlides, imagePath }, 'Digest slayt kartı üretildi');
  return imagePath;
}

/**
 * Instagram Reels için 16:9 görsel içeren katman SVG'si
 */
function buildReelsOverlaySvg(
  title: string,
  sourceName: string,
  publishedAt: Date,
  width: number,
  height: number,
  accentColor: string,
  fgY: number,
  fgHeight: number,
  badgeText?: string,
): string {
  const safeSource = escapeXml(sourceName);
  const dateStr = publishedAt.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const safeDateStr = escapeXml(dateStr);

  const topSafeY = 240;
  const textYStart = fgY + fgHeight + 70; // 350 + 540 + 70 = 960

  const wrapped = wrapText(title, 24);
  const titleLines = escapeXml(wrapped).split('\n');
  const titleLineHeight = 74;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${textYStart + i * titleLineHeight}" font-family="'Segoe UI', Arial, sans-serif" font-size="54" font-weight="800" fill="white" letter-spacing="-0.5">${line}</text>`,
    )
    .join('\n');

  const topBadge = badgeText ? escapeXml(badgeText) : safeSource;
  const badgeWidth = Math.min(topBadge.length * 20 + 44, 460);
  const subMetaText = badgeText ? `${safeSource} • ${safeDateStr}` : safeDateStr;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Alt Reels UI için yumuşak karartma -->
    <linearGradient id="reelsBottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#000000;stop-opacity:0" />
      <stop offset="100%" style="stop-color:#000000;stop-opacity:0.92" />
    </linearGradient>
  </defs>

  <!-- Üst Güvenli Alan: Rozet (Sol) ve DonanımPost (Sağ) -->
  <rect x="80" y="${topSafeY}" width="${badgeWidth}" height="52" rx="14" fill="${badgeText ? accentColor : 'white'}" fill-opacity="${badgeText ? '0.9' : '0.18'}" />
  <text x="102" y="${topSafeY + 35}" font-family="'Segoe UI', Arial, sans-serif" font-size="22" font-weight="800" fill="white">${topBadge}</text>

  <text x="${width - 80}" y="${topSafeY + 36}" text-anchor="end" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="800" fill="white" fill-opacity="0.9" letter-spacing="1">DonanımPost</text>

  <!-- Sol vurgulu çizgi -->
  <rect x="56" y="${textYStart - 44}" width="8" height="${titleLines.length * titleLineHeight}" rx="4" fill="${accentColor}" />

  <!-- Başlık -->
  ${titleSvg}

  <!-- Meta Bilgi (Kaynak ve Tarih) -->
  <text x="80" y="${textYStart + titleLines.length * titleLineHeight + 35}" font-family="'Segoe UI', Arial, sans-serif" font-size="24" font-weight="500" fill="#94a3b8">${subMetaText}</text>

  <!-- Instagram alt UI (profil, açıklama, ses şeridi) için güvenli zemin -->
  <rect x="0" y="1250" width="${width}" height="${height - 1250}" fill="url(#reelsBottomFade)" />
</svg>`;
}

/**
 * Instagram Reels için görselsiz gradient template SVG'si
 */
function buildReelsTemplateSvg(
  title: string,
  sourceName: string,
  publishedAt: Date,
  width: number,
  height: number,
  fromColor: string,
  toColor: string,
  badgeText?: string,
): string {
  const safeSource = escapeXml(sourceName);
  const dateStr = publishedAt.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const safeDateStr = escapeXml(dateStr);

  const topSafeY = 240;
  const wrapped = wrapText(title, 22);
  const titleLines = escapeXml(wrapped).split('\n');
  const titleLineHeight = 84;
  const titleYStart = 780;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${titleYStart + i * titleLineHeight}" font-family="'Segoe UI', Arial, sans-serif" font-size="60" font-weight="800" fill="white" letter-spacing="-0.5">${line}</text>`,
    )
    .join('\n');

  const topBadge = badgeText ? escapeXml(badgeText) : safeSource;
  const badgeWidth = Math.min(topBadge.length * 20 + 44, 460);
  const subMetaText = badgeText ? `${safeSource} • ${safeDateStr}` : safeDateStr;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="reelsBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${fromColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${toColor};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="reelsBottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#000000;stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:#000000;stop-opacity:0.95" />
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#reelsBg)" />

  <!-- Dekoratif subtle desenler -->
  <circle cx="${width * 0.85}" cy="${height * 0.25}" r="320" fill="white" fill-opacity="0.04"/>
  <circle cx="${width * 0.15}" cy="${height * 0.65}" r="280" fill="white" fill-opacity="0.03"/>

  <!-- Üst Güvenli Alan: Rozet (Sol) ve DonanımPost (Sağ) -->
  <rect x="80" y="${topSafeY}" width="${badgeWidth}" height="52" rx="14" fill="white" fill-opacity="0.22" />
  <text x="102" y="${topSafeY + 35}" font-family="'Segoe UI', Arial, sans-serif" font-size="22" font-weight="800" fill="white">${topBadge}</text>

  <text x="${width - 80}" y="${topSafeY + 36}" text-anchor="end" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="800" fill="white" fill-opacity="0.9" letter-spacing="1">DonanımPost</text>

  <!-- Sol vurgulu çizgi -->
  <rect x="56" y="${titleYStart - 50}" width="8" height="${titleLines.length * titleLineHeight}" rx="4" fill="white" fill-opacity="0.8" />

  <!-- Başlık -->
  ${titleSvg}

  <!-- Meta Bilgi (Kaynak ve Tarih) -->
  <text x="80" y="${titleYStart + titleLines.length * titleLineHeight + 40}" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="500" fill="#cbd5e1">${subMetaText}</text>

  <!-- Alt Reels UI Karartması -->
  <rect x="0" y="1250" width="${width}" height="${height - 1250}" fill="url(#reelsBottomFade)" />
</svg>`;
}

/**
 * SVG tabanlı görsel template üret (X / Twitter 16:9 ve diğerleri için)
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
  transparentBg: boolean = false,
): string {
  let charsPerLine = 45;
  let titleFontSize = 36;
  let titleLineHeight = 48;
  let titleBaseY = height - 195;
  let textX = 60;

  if (format === '4:5') {
    charsPerLine = 35;
    titleFontSize = 52;
    titleLineHeight = 68;
    titleBaseY = height - 150;
    textX = 80;
  }

  const safeTitle = escapeXml(wrapText(title, charsPerLine));
  const safeSource = escapeXml(sourceName);
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
  const titleYStart = titleBaseY - titleLines.length * titleLineHeight;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${textX}" y="${titleYStart + i * titleLineHeight}" font-family="'Segoe UI', Arial, sans-serif" font-size="${titleFontSize}" font-weight="700" fill="white" letter-spacing="-0.5">${line}</text>`,
    )
    .join('\n');

  const circleR1 = format === '4:5' ? 300 : 200;
  const circleR2 = format === '4:5' ? 250 : 150;
  const sourceY = format === '4:5' ? 36 : 24;
  const sourceHeight = format === '4:5' ? 54 : 42;
  const sourceFontSize = format === '4:5' ? 24 : 18;
  const bottomBarY = height - (format === '4:5' ? 80 : 55);
  const bottomBarHeight = format === '4:5' ? 80 : 55;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${fromColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${toColor};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:transparent;stop-opacity:0" />
      <stop offset="60%" style="stop-color:#000000;stop-opacity:0.75" />
      <stop offset="100%" style="stop-color:#000000;stop-opacity:0.95" />
    </linearGradient>
  </defs>

  <!-- Arka plan gradient veya hafif karartma -->
  ${transparentBg ? `<rect width="${width}" height="${height}" fill="rgba(0,0,0,0.4)" />` : `<rect width="${width}" height="${height}" fill="url(#bg)" />`}

  <!-- Dekoratif desen — subtle grid lines -->
  ${!transparentBg ? `
  <line x1="0" y1="0" x2="${width}" y2="${height}" stroke="white" stroke-opacity="0.03" stroke-width="1"/>
  <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="white" stroke-opacity="0.03" stroke-width="1"/>
  <circle cx="${width * 0.8}" cy="${height * 0.2}" r="${circleR1}" fill="white" fill-opacity="0.03"/>
  <circle cx="${width * 0.1}" cy="${height * 0.8}" r="${circleR2}" fill="white" fill-opacity="0.02"/>
  ` : ''}

  <!-- Overlay gradient (alt karartma) -->
  <rect width="${width}" height="${height}" fill="url(#overlay)" />

  <!-- Sol kenar vurgu çizgisi -->
  <rect x="0" y="0" width="${format === '16:9' ? 5 : 8}" height="${height}" fill="white" fill-opacity="0.8" />

  <!-- Kaynak etiketi (sol üst) -->
  <rect x="${textX}" y="${sourceY}" width="${Math.min(safeSource.length * (format === '4:5' ? 16 : 11) + 48, 450)}" height="${sourceHeight}" rx="10" fill="white" fill-opacity="0.18" />
  <text x="${textX + 24}" y="${sourceY + (format === '4:5' ? 36 : 28)}" font-family="'Segoe UI', Arial, sans-serif" font-size="${sourceFontSize}" font-weight="600" fill="white">${safeSource}</text>

  <!-- Haber başlığı (alt orta) -->
  ${titleSvg}

  <!-- Alt bilgi çubuğu -->
  <rect x="0" y="${bottomBarY}" width="${width}" height="${bottomBarHeight}" fill="black" fill-opacity="0.6" />

  <!-- Tarih (alt sol) -->
  <text x="${textX}" y="${bottomBarY + (format === '4:5' ? 48 : 34)}" font-family="'Segoe UI', Arial, sans-serif" font-size="${format === '4:5' ? 22 : 16}" fill="#a0a0a0">${safeDateStr}</text>

  <!-- DonanımPost brand (alt sağ) -->
  <text x="${width - textX}" y="${bottomBarY + (format === '4:5' ? 48 : 34)}" text-anchor="end" font-family="'Segoe UI', Arial, sans-serif" font-size="${format === '4:5' ? 24 : 16}" font-weight="700" fill="#a0a0a0">DonanımPost</text>
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
    ai: 'YAPAY ZEKA',
    mobile: 'AKILLI TELEFON',
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
