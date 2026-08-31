/**
 * AutoSocial — Haber Kaynakları Konfigürasyonu
 *
 * Niş: PC Donanım, Çevre Birimleri, Oyun Haberleri, Fırsatlar/İndirimler
 * Dil: EN + TR (tweet dili her zaman TR)
 *
 * Kaynak güvenilirliği: 1-5 (reliability skoru)
 * - 5: Birincil kaynak, çok güvenilir
 * - 4: Güvenilir, iyi editoryal standartlar
 * - 3: Orta, bazen tıklama tuzağı
 * - 2: Düşük, dikkatli kullan
 * - 1: Çok düşük, kara listede olmadığı için dahil
 */

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  rssUrl: string;
  lang: 'en' | 'tr';
  reliability: 1 | 2 | 3 | 4 | 5;
  categories: string[];
  isActive: boolean;
}

export const SOURCES: SourceConfig[] = [
  // ─── İNGİLİZCE KAYNAKLAR (Hız arbitrajı için öncelikli) ────────────────────

  {
    id: 'anandtech',
    name: 'AnandTech',
    url: 'https://www.anandtech.com',
    rssUrl: 'https://www.anandtech.com/rss/',
    lang: 'en',
    reliability: 5,
    categories: ['donanım', 'işlemci', 'ekran kartı', 'bellek', 'depolama'],
    isActive: false, // RSS bozuk XML döndürüyor — site 2023'ten beri pasif
  },
  {
    id: 'tomshardware',
    name: "Tom's Hardware",
    url: 'https://www.tomshardware.com',
    rssUrl: 'https://www.tomshardware.com/feeds/all',
    lang: 'en',
    reliability: 5,
    categories: ['donanım', 'işlemci', 'ekran kartı', 'bellek', 'test', 'fırsat'],
    isActive: true,
  },
  {
    id: 'techpowerup',
    name: 'TechPowerUp',
    url: 'https://www.techpowerup.com',
    rssUrl: 'https://www.techpowerup.com/rss/news.xml',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'ekran kartı', 'sürücü'],
    isActive: true,
  },
  {
    id: 'hardwareluxx',
    name: 'HardwareLuxx',
    url: 'https://www.hardwareluxx.com',
    rssUrl: 'https://www.hardwareluxx.com/rss/rss_news.xml',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'işlemci', 'ekran kartı'],
    isActive: true,
  },
  {
    id: 'theverge_tech',
    name: 'The Verge',
    url: 'https://www.theverge.com',
    rssUrl: 'https://www.theverge.com/rss/index.xml',
    lang: 'en',
    reliability: 4,
    categories: ['teknoloji', 'donanım', 'oyun'],
    isActive: true,
  },
  {
    id: 'techradar',
    name: 'TechRadar',
    url: 'https://www.techradar.com',
    rssUrl: 'https://www.techradar.com/rss',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'fırsat', 'inceleme'],
    isActive: true,
  },
  {
    id: 'pcmag',
    name: 'PCMag',
    url: 'https://www.pcmag.com',
    rssUrl: 'https://www.pcmag.com/rss/all',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'inceleme', 'fırsat'],
    isActive: true,
  },
  {
    id: 'videocardz',
    name: 'Videocardz',
    url: 'https://videocardz.com',
    rssUrl: 'https://videocardz.com/feed',
    lang: 'en',
    reliability: 4,
    categories: ['ekran kartı', 'donanım'],
    isActive: true,
  },
  {
    id: 'overclock3d',
    name: 'Overclock3D',
    url: 'https://www.overclock3d.net',
    rssUrl: 'https://overclock3d.net/rss',
    lang: 'en',
    reliability: 3,
    categories: ['donanım', 'test', 'overclock'],
    isActive: true,
  },

  // ─── TÜRKÇE KAYNAKLAR ──────────────────────────────────────────────────────

  {
    id: 'donanimhaber',
    name: 'Donanım Haber',
    url: 'https://www.donanimhaber.com',
    rssUrl: 'https://www.donanimhaber.com/rss/',
    lang: 'tr',
    reliability: 5,
    categories: ['donanım', 'fırsat', 'inceleme', 'işlemci', 'ekran kartı'],
    isActive: true,
  },
  {
    id: 'chip_tr',
    name: 'Chip Online TR',
    url: 'https://chip.com.tr',
    rssUrl: 'https://chip.com.tr/feed',
    lang: 'tr',
    reliability: 4,
    categories: ['donanım', 'teknoloji', 'oyun'],
    isActive: true,
  },
  {
    id: 'shiftdelete',
    name: 'ShiftDelete.net',
    url: 'https://shiftdelete.net',
    rssUrl: 'https://shiftdelete.net/feed',
    lang: 'tr',
    reliability: 3,
    categories: ['donanım', 'teknoloji', 'fırsat'],
    isActive: true,
  },
  {
    id: 'webtekno',
    name: 'Webtekno',
    url: 'https://www.webtekno.com',
    rssUrl: 'https://www.webtekno.com/rss.xml',
    lang: 'tr',
    reliability: 3,
    categories: ['teknoloji', 'donanım', 'oyun'],
    isActive: true,
  },

  // ─── OYUN FIRSATLARI VE ÜCRETSİZ OYUN KAYNAKLARI ──────────────────────────

  {
    id: 'pcgamer',
    name: 'PC Gamer',
    url: 'https://www.pcgamer.com',
    rssUrl: 'https://www.pcgamer.com/rss/',
    lang: 'en',
    reliability: 4,
    categories: ['oyun', 'fırsat', 'ücretsiz oyun', 'inceleme'],
    isActive: true,
    // PC Gamer Epic Games haftalık ücretsiz oyun haberlerini düzenli yapar
  },
  {
    id: 'rockpapershotgun',
    name: 'Rock Paper Shotgun',
    url: 'https://www.rockpapershotgun.com',
    rssUrl: 'https://www.rockpapershotgun.com/feed',
    lang: 'en',
    reliability: 4,
    categories: ['oyun', 'inceleme', 'ücretsiz oyun'],
    isActive: true,
    // PC oyunlarına odaklı, Epic/Steam ücretsiz oyun haberlerini yakından takip eder
  },
  {
    id: 'humblebundle_blog',
    name: 'Humble Bundle Blog',
    url: 'https://blog.humblebundle.com',
    rssUrl: 'https://blog.humblebundle.com/rss',
    lang: 'en',
    reliability: 5,
    categories: ['oyun', 'fırsat', 'ücretsiz oyun', 'bundle'],
    isActive: true,
    // Resmi Humble Bundle blogu — bundle ve ücretsiz oyun duyuruları için birincil kaynak
  },
  {
    id: 'isthereanydeal',
    name: 'IsThereAnyDeal',
    url: 'https://isthereanydeal.com',
    rssUrl: 'https://isthereanydeal.com/feed/',
    lang: 'en',
    reliability: 4,
    categories: ['fırsat', 'indirim', 'ücretsiz oyun', 'fiyat takibi'],
    isActive: false, // RSS 404 döndürüyor — resmi RSS desteği yok
  },
  {
    id: 'eurogamer',
    name: 'Eurogamer',
    url: 'https://www.eurogamer.net',
    rssUrl: 'https://www.eurogamer.net/?format=rss',
    lang: 'en',
    reliability: 4,
    categories: ['oyun', 'fırsat', 'ücretsiz oyun', 'inceleme'],
    isActive: true,
    // Avrupa odaklı güçlü oyun habercisi, Epic/Steam ücretsiz oyun haberlerini kapsar
  },
];

export function getActiveSources(): SourceConfig[] {
  return SOURCES.filter((s) => s.isActive);
}

export function getSourceById(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}
