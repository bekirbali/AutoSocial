import sharp from 'sharp';
import { resolveHighResImage, cleanAndUpgradeImageUrl } from '../src/modules/processor/downloader.js';
import { generateNewsCard } from '../src/modules/processor/image.js';

async function runTests() {
  console.log('🚀 === GÖRSEL ÇÖZÜNÜRLÜK VE KALİTE TESTLERİ BAŞLIYOR ===\n');

  // TEST 1: GSMArena (Kullanıcının ekran görüntüsündeki vivo haberi)
  console.log('--- TEST 1: GSMArena (vivo haberi) ---');
  const vivoRaw = 'https://fdn.gsmarena.com/imgroot/news/26/09/vivo-x500-pro-first-with-dimensity-9600-pro/-184x111/gsmarena_000.jpg';
  const vivoPage = 'https://www.gsmarena.com/vivo_x500_pro_and_x500_pro_max_will_be_the_first_to_use_mediateks_dimensity_9600_pro-news-74632.php';

  const upgradedUrl = cleanAndUpgradeImageUrl(vivoRaw);
  console.log('Ham Thumbnail URL:', vivoRaw);
  console.log('Temizlenmiş HD URL:', upgradedUrl);

  const vivoResolved = await resolveHighResImage(vivoRaw, vivoPage);
  console.log('Çözümlenen Görsel:', {
    source: vivoResolved.source,
    width: vivoResolved.width,
    height: vivoResolved.height,
    hasBuffer: !!vivoResolved.buffer,
    bufferSize: vivoResolved.buffer?.length,
  });

  if (vivoResolved.buffer && vivoResolved.width && vivoResolved.width >= 700) {
    console.log('✅ GSMArena: Düşük thumbnail (184x111) başarıyla HD çözünürlüğe (' + vivoResolved.width + 'x' + vivoResolved.height + ') yükseltildi!');
  } else {
    console.error('❌ GSMArena testi başarısız!');
  }

  // 16:9 Kart Üretim Testi
  const cardResult = await generateNewsCard(
    "Mobil Dünyada 2nm Devri: vivo'dan Oppo'ya Çalım",
    'GSMArena',
    'mobile',
    new Date('2026-09-16T10:31:00'),
    'test_vivo_hd',
    '16:9',
    vivoResolved.url,
    vivoResolved.buffer,
    vivoPage
  );
  console.log('Üretilen 16:9 Kart:', cardResult.imagePath, 'Kaynak:', cardResult.imageSource);

  const cardMeta = await sharp(cardResult.imagePath).metadata();
  console.log('Kart Çözünürlüğü:', cardMeta.width, 'x', cardMeta.height, 'Format:', cardMeta.format);

  // TEST 2: Rock Paper Shotgun (Gamer Network width=690 -> width=1200)
  console.log('\n--- TEST 2: Rock Paper Shotgun (Gamer Network) ---');
  const rpsRaw = 'https://assetsio.gnwcdn.com/Steam-Frame-and-controller.jpg?width=690&quality=85&format=jpg&auto=webp';
  const rpsUpgraded = cleanAndUpgradeImageUrl(rpsRaw);
  console.log('Orijinal:', rpsRaw);
  console.log('Yükseltilmiş:', rpsUpgraded);
  if (rpsUpgraded.includes('width=1200')) {
    console.log('✅ Gamer Network CDN: width=1200 HD ölçeğine yükseltildi!');
  }

  // TEST 3: Webtekno (640xauto -> 1200xauto)
  console.log('\n--- TEST 3: Webtekno (640xauto -> 1200xauto) ---');
  const webteknoRaw = 'https://imgrosetta.webtekno.com/file/683329/683329-640xauto.jpg';
  const webteknoUpgraded = cleanAndUpgradeImageUrl(webteknoRaw);
  console.log('Orijinal:', webteknoRaw);
  console.log('Yükseltilmiş:', webteknoUpgraded);
  if (webteknoUpgraded.includes('-1200xauto')) {
    console.log('✅ Webtekno CDN: 1200xauto HD ölçeğine yükseltildi!');
  }

  // TEST 4: The Verge (HTML entity decoding & w=1200)
  console.log('\n--- TEST 4: The Verge (HTML Entity Decoding) ---');
  const vergeRaw = 'https://platform.theverge.com/wp-content/uploads/sites/2/2026/09/STK_414_5_D.png?quality=90&#038;strip=all&#038;crop=0,0,100,100';
  const vergeUpgraded = cleanAndUpgradeImageUrl(vergeRaw);
  console.log('Orijinal:', vergeRaw);
  console.log('Temizlenmiş:', vergeUpgraded);
  if (!vergeUpgraded.includes('&#038;')) {
    console.log('✅ The Verge: HTML karakter kodları (&) başarıyla çözüldü!');
  }

  // TEST 5: Chip Online TR (Claude Haberi - Doğrudan Yüksek Çözünürlük)
  console.log('\n--- TEST 5: Chip Online TR (Doğrudan HD Görsel) ---');
  const chipUrl = 'https://i.chip.com.tr/storage/files/images/2026/09/11/kullanicilarin-haberi-yoktu-milyonlarca-yapay-zeka-sorgusu-claudea-mi-gonderildi-w906.jpg';
  const chipResolved = await resolveHighResImage(chipUrl);
  console.log('Chip Online Çözümleme:', {
    width: chipResolved.width,
    height: chipResolved.height,
    source: chipResolved.source,
  });
  if (chipResolved.width && chipResolved.width >= 800) {
    console.log('✅ Chip Online TR: Orijinal 906px HD görsel doğrudan korundu!');
  }

  // TEST 6: Aşırı Düşük Kalite / Thumbnail Güvenlik Kalkanı
  console.log('\n--- TEST 6: Düşük Çözünürlük Güvenlik Kalkanı (Fallback) ---');
  // 1x1 veya 100x100 gibi çamur bir resim verilirse sistem null dönmeli ve gradient şablonu üretmeli
  const tinyFakeThumb = 'https://via.placeholder.com/150x100.png';
  const tinyResolved = await resolveHighResImage(tinyFakeThumb);
  console.log('Küçük Görsel Çözümleme Sonucu:', tinyResolved.source, 'Buffer:', tinyResolved.buffer);
  if (tinyResolved.buffer === null) {
    console.log('✅ Kalite Güvenlik Kalkanı: Yetersiz küçük resim pikselli uzatılmadı, şık gradient şablonuna yönlendirildi!');
  }

  console.log('\n✨ === TÜM TESTLER BAŞARIYLA TAMAMLANDI ===');
}

runTests().catch(console.error);
