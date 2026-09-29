import { generateNewsCarousel } from '../src/modules/processor/carouselGenerator.js';
import fs from 'fs';

async function testCarousel() {
  console.log('Testing Instagram Carousel generation...');
  const res = await generateNewsCarousel({
    hook: "PS5'ten 3 Kat Güçlü? PS6 İçin 40 TFLOPS İddiası",
    summaryTitle: '40 TFLOPS Güç Geliyor',
    summary: 'Sony nin yeni nesil PlayStation 6 konsolunun kırk TFLOPS işlem gücüne sahip olacağı ve özel RDNA mimarisiyle geleceği sızdırıldı.',
    commentaryTitle: 'Fiyat 50 Bini Aşabilir',
    commentary: 'Bu donanım gücü doğrulanırsa Türkiye de konsolun çıkış fiyatı 50 bin TL barajını rahatça geçebilir. Mevcut konsol sahipleri için hemen yükseltme ihtiyacı doğmayabilir.',
    questionTitle: 'Bu Güce Değer mi?',
    question: 'Sizce konsolda bu devasa güç için 50 bin TL ödenir mi?',
    sourceName: "Tom's Hardware",
    category: 'gaming',
    articleId: 'test_carousel_ps6',
    imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=1600&q=85',
  });

  console.log('Carousel created successfully!');
  console.log('Slides:', res.slidePaths);
  for (const s of res.slidePaths) {
    console.log(`- ${s} (${fs.statSync(s).size} bytes)`);
  }
}

testCarousel().catch(console.error);
