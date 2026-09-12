/**
 * AutoSocial — Haber Kaynakları Konfigürasyonu
 *
 * Niş: PC Donanım, Çevre Birimleri, Akıllı Telefon & Mobil Teknoloji, Oyun Haberleri, Fırsatlar/İndirimler
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
  rssUrl: string; // Reddit için subreddit adı veya rss formatı, örn: reddit:PublicFreakout
  type?: 'rss' | 'reddit';
  lang: 'en' | 'tr' | 'de';
  reliability: 1 | 2 | 3 | 4 | 5;
  categories: string[];
  isActive: boolean;
}

export const SOURCES: SourceConfig[] = [
  // ─── YABANCI KAYNAKLAR (Hız arbitrajı için öncelikli) ────────────────────

  {
    id: 'anandtech',
    name: 'AnandTech',
    url: 'https://www.anandtech.com',
    rssUrl: 'https://www.anandtech.com/rss/',
    lang: 'en',
    reliability: 5,
    categories: ['donanım', 'işlemci', 'ekran kartı', 'bellek', 'depolama'],
    isActive: false, // Site Ağustos 2024'te kapandı
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
    rssUrl: 'https://www.techpowerup.com/rss/news',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'ekran kartı', 'sürücü', 'işlemci'],
    isActive: true,
  },
  {
    id: 'hardwareluxx',
    name: 'HardwareLuxx',
    url: 'https://www.hardwareluxx.de',
    rssUrl: 'https://www.hardwareluxx.de/hwl.feed',
    lang: 'de',
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
    isActive: false, // Cloudflare Turnstile bot koruması nedeniyle RSS erişimi engelleniyor
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
    rssUrl: 'https://overclock3d.net/feed',
    lang: 'en',
    reliability: 3,
    categories: ['donanım', 'test', 'overclock'],
    isActive: true,
  },
  {
    id: 'gsmarena',
    name: 'GSMArena',
    url: 'https://www.gsmarena.com',
    rssUrl: 'https://www.gsmarena.com/rss-news-reviews.php3',
    lang: 'en',
    reliability: 5,
    categories: ['mobil', 'akıllı telefon', 'donanım'],
    isActive: true,
  },
  {
    id: '9to5mac',
    name: '9to5Mac',
    url: 'https://9to5mac.com',
    rssUrl: 'https://9to5mac.com/feed/',
    lang: 'en',
    reliability: 5,
    categories: ['apple', 'iphone', 'mobil'],
    isActive: true,
  },
  {
    id: 'sammobile',
    name: 'SamMobile',
    url: 'https://www.sammobile.com',
    rssUrl: 'https://www.sammobile.com/feed/',
    lang: 'en',
    reliability: 4,
    categories: ['samsung', 'galaxy', 'mobil'],
    isActive: true,
  },
  {
    id: 'reddit_publicfreakout',
    name: 'Reddit PublicFreakout',
    url: 'https://www.reddit.com/r/PublicFreakout',
    rssUrl: 'PublicFreakout',
    type: 'reddit',
    lang: 'en',
    reliability: 3,
    categories: ['genel', 'video'], // Sadece test amaçlı, normalde donanım kategorisi olur
    isActive: false, // TODO: API entegrasyonu yapılınca true yapılacak
  },
  {
    id: 'reddit_crazyfuckingvideos',
    name: 'Reddit CrazyFuckingVideos',
    url: 'https://www.reddit.com/r/CrazyFuckingVideos',
    rssUrl: 'CrazyFuckingVideos',
    type: 'reddit',
    lang: 'en',
    reliability: 3,
    categories: ['genel', 'video'],
    isActive: false, // TODO: API entegrasyonu yapılınca true yapılacak
  },
  {
    id: 'reddit_interestingasfuck',
    name: 'Reddit interestingasfuck',
    url: 'https://www.reddit.com/r/interestingasfuck',
    rssUrl: 'interestingasfuck',
    type: 'reddit',
    lang: 'en',
    reliability: 3,
    categories: ['genel', 'video'],
    isActive: false, // TODO: API entegrasyonu yapılınca true yapılacak
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
    isActive: false, // Donanım Haber RSS sistemini kapattığı için (HTML dönüyor) askıya alındı
  },
  {
    id: 'chip_tr',
    name: 'Chip Online TR',
    url: 'https://chip.com.tr',
    rssUrl: 'https://www.chip.com.tr/rss',
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
    rssUrl: 'https://blog.humblebundle.com/feed/',
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
