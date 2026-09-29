import sharp from 'sharp';
import fs from 'fs';

async function prepareBrandAssets() {
  const src = 'assets/brand/teknofiltre_logo.jpg';

  // 1. Master 1024x1024
  await sharp(src)
    .resize(1024, 1024)
    .jpeg({ quality: 96 })
    .toFile('assets/brand/teknofiltre_master_1024.jpg');

  // 2. Daire Avatar (X / Instagram / Telegram için hazır 800x800 PNG)
  const circleSvg = Buffer.from(
    '<svg width="800" height="800"><circle cx="400" cy="400" r="398" fill="#000"/></svg>'
  );
  await sharp(src)
    .resize(800, 800)
    .composite([{ input: circleSvg, blend: 'dest-in' }])
    .png()
    .toFile('assets/brand/teknofiltre_avatar_circle_800.png');

  // 3. Rozet / Video Watermark için 200x200
  await sharp(src)
    .resize(200, 200)
    .png()
    .toFile('assets/brand/teknofiltre_icon_200.png');

  console.log('Tüm marka varlıkları başarıyla üretildi.');
}

prepareBrandAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
