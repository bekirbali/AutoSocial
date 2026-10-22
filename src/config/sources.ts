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
  // ─── YENİ NİŞ: AI / HACKER / BUILDER & DEV TOOLS (Öncelikli Kaynaklar) ────

  {
    id: 'huggingface_blog',
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog',
    rssUrl: 'https://huggingface.co/blog/feed.xml',
    lang: 'en',
    reliability: 5,
    categories: ['ai', 'açık kaynak', 'model savaşları', 'llm', 'benchmark'],
    isActive: true,
  },
  {
    id: 'hn_frontpage',
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    rssUrl: 'https://hnrss.org/frontpage',
    lang: 'en',
    reliability: 5,
    categories: ['hacker', 'builder', 'açık kaynak', 'geliştirici', 'ai'],
    isActive: true,
  },
  {
    id: 'theverge_ai',
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    rssUrl: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    lang: 'en',
    reliability: 4,
    categories: ['ai', 'model savaşları', 'teknoloji', 'tüketici etkisi'],
    isActive: true,
  },
  {
    id: 'arstechnica_tech',
    name: 'Ars Technica Tech Lab',
    url: 'https://arstechnica.com/information-technology/',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    lang: 'en',
    reliability: 5,
    categories: ['teknoloji', 'ai', 'güvenlik', 'analiz'],
    isActive: true,
  },
  {
    id: 'techcrunch_ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/',
    rssUrl: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    lang: 'en',
    reliability: 4,
    categories: ['ai', 'girişim', 'model savaşları', 'teknoloji'],
    isActive: true,
  },
  {
    id: 'changelog',
    name: 'Changelog',
    url: 'https://changelog.com',
    rssUrl: 'https://changelog.com/feed',
    lang: 'en',
    reliability: 5,
    categories: ['açık kaynak', 'builder', 'geliştirici araçları', 'yazılım'],
    isActive: true,
  },
  {
    id: 'github_blog',
    name: 'GitHub Blog',
    url: 'https://github.blog',
    rssUrl: 'https://github.blog/feed/',
    lang: 'en',
    reliability: 5,
    categories: ['açık kaynak', 'geliştirici', 'ai', 'copilot'],
    isActive: true,
  },
  {
    id: 'bleepingcomputer',
    name: 'BleepingComputer',
    url: 'https://www.bleepingcomputer.com',
    rssUrl: 'https://www.bleepingcomputer.com/feed/',
    lang: 'en',
    reliability: 4,
    categories: ['güvenlik', 'hacker', 'bypass', 'yazılım'],
    isActive: true,
  },
  {
    id: 'simonwillison',
    name: "Simon Willison's Weblog",
    url: 'https://simonwillison.net',
    rssUrl: 'https://simonwillison.net/atom/everything/',
    lang: 'en',
    reliability: 5,
    categories: ['ai', 'llm', 'builder', 'araçlar', 'açık kaynak'],
    isActive: true,
  },
  {
    id: 'eightylevel',
    name: '80 Level',
    url: 'https://80.lv',
    rssUrl: 'https://80.lv/feed',
    lang: 'en',
    reliability: 4,
    categories: ['oyun geliştirme', 'ai gaming', 'modlama', '3d', 'unreal'],
    isActive: true,
  },

  // ─── TÜRKÇE AI & TEKNOLOJİ KAYNAKLARI ─────────────────────────────────────

  {
    id: 'webrazzi_ai',
    name: 'Webrazzi Yapay Zeka',
    url: 'https://webrazzi.com/kategori/yapay-zeka/',
    rssUrl: 'https://webrazzi.com/kategori/yapay-zeka/feed/',
    lang: 'tr',
    reliability: 4,
    categories: ['ai', 'yapay zeka', 'girişim', 'türkiye'],
    isActive: true,
  },
  {
    id: 'swipeline',
    name: 'Swipeline',
    url: 'https://swipeline.co',
    rssUrl: 'https://swipeline.co/feed/',
    lang: 'tr',
    reliability: 4,
    categories: ['teknoloji', 'girişim', 'ai'],
    isActive: true,
  },

  /*
  // ─── ESKİ / ARŞİVLENEN DONANIM, MOBİL VE OYUN KAYNAKLARI (İLERİDE LAZIM OLURSA) ────
  // İhtiyaç halinde isActive: true yapılarak veya bu yorum bloğu kaldırılarak tekrar açılabilir.

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
    isActive: false,
  },
  {
    id: 'techpowerup',
    name: 'TechPowerUp',
    url: 'https://www.techpowerup.com',
    rssUrl: 'https://www.techpowerup.com/rss/news',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'ekran kartı', 'sürücü', 'işlemci'],
    isActive: false,
  },
  {
    id: 'hardwareluxx',
    name: 'HardwareLuxx',
    url: 'https://www.hardwareluxx.de',
    rssUrl: 'https://www.hardwareluxx.de/hwl.feed',
    lang: 'de',
    reliability: 4,
    categories: ['donanım', 'işlemci', 'ekran kartı'],
    isActive: false,
  },
  {
    id: 'techradar',
    name: 'TechRadar',
    url: 'https://www.techradar.com',
    rssUrl: 'https://www.techradar.com/rss',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'fırsat', 'inceleme'],
    isActive: false,
  },
  {
    id: 'pcmag',
    name: 'PCMag',
    url: 'https://www.pcmag.com',
    rssUrl: 'https://www.pcmag.com/rss/all',
    lang: 'en',
    reliability: 4,
    categories: ['donanım', 'inceleme', 'fırsat'],
    isActive: false,
  },
  {
    id: 'videocardz',
    name: 'Videocardz',
    url: 'https://videocardz.com',
    rssUrl: 'https://videocardz.com/feed',
    lang: 'en',
    reliability: 4,
    categories: ['ekran kartı', 'donanım'],
    isActive: false,
  },
  {
    id: 'overclock3d',
    name: 'Overclock3D',
    url: 'https://www.overclock3d.net',
    rssUrl: 'https://www.overclock3d.net/feed',
    lang: 'en',
    reliability: 3,
    categories: ['donanım', 'test', 'overclock'],
    isActive: false,
  },
  {
    id: 'gsmarena',
    name: 'GSMArena',
    url: 'https://www.gsmarena.com',
    rssUrl: 'https://www.gsmarena.com/rss-news-reviews.php3',
    lang: 'en',
    reliability: 5,
    categories: ['mobil', 'akıllı telefon', 'donanım'],
    isActive: false,
  },
  {
    id: '9to5mac',
    name: '9to5Mac',
    url: 'https://9to5mac.com',
    rssUrl: 'https://9to5mac.com/feed/',
    lang: 'en',
    reliability: 5,
    categories: ['apple', 'iphone', 'mobil'],
    isActive: false,
  },
  {
    id: 'sammobile',
    name: 'SamMobile',
    url: 'https://www.sammobile.com',
    rssUrl: 'https://www.sammobile.com/feed/',
    lang: 'en',
    reliability: 4,
    categories: ['samsung', 'galaxy', 'mobil'],
    isActive: false,
  },
  {
    id: 'donanimhaber',
    name: 'Donanım Haber',
    url: 'https://www.donanimhaber.com',
    rssUrl: 'https://www.donanimhaber.com/rss/',
    lang: 'tr',
    reliability: 5,
    categories: ['donanım', 'fırsat', 'inceleme', 'işlemci', 'ekran kartı'],
    isActive: false,
  },
  {
    id: 'chip_tr',
    name: 'Chip Online TR',
    url: 'https://chip.com.tr',
    rssUrl: 'https://www.chip.com.tr/rss',
    lang: 'tr',
    reliability: 4,
    categories: ['donanım', 'teknoloji', 'oyun'],
    isActive: false,
  },
  {
    id: 'shiftdelete',
    name: 'ShiftDelete.net',
    url: 'https://shiftdelete.net',
    rssUrl: 'https://shiftdelete.net/feed',
    lang: 'tr',
    reliability: 3,
    categories: ['donanım', 'teknoloji', 'fırsat'],
    isActive: false,
  },
  {
    id: 'webtekno',
    name: 'Webtekno',
    url: 'https://www.webtekno.com',
    rssUrl: 'https://www.webtekno.com/rss.xml',
    lang: 'tr',
    reliability: 3,
    categories: ['teknoloji', 'donanım', 'oyun'],
    isActive: false,
  },
  {
    id: 'pcgamer',
    name: 'PC Gamer',
    url: 'https://www.pcgamer.com',
    rssUrl: 'https://www.pcgamer.com/rss/',
    lang: 'en',
    reliability: 4,
    categories: ['oyun', 'fırsat', 'ücretsiz oyun', 'inceleme'],
    isActive: false,
  },
  {
    id: 'rockpapershotgun',
    name: 'Rock Paper Shotgun',
    url: 'https://www.rockpapershotgun.com',
    rssUrl: 'https://www.rockpapershotgun.com/feed',
    lang: 'en',
    reliability: 4,
    categories: ['oyun', 'inceleme', 'ücretsiz oyun'],
    isActive: false,
  },
  {
    id: 'humblebundle_blog',
    name: 'Humble Bundle Blog',
    url: 'https://blog.humblebundle.com',
    rssUrl: 'https://blog.humblebundle.com/feed/',
    lang: 'en',
    reliability: 5,
    categories: ['oyun', 'fırsat', 'ücretsiz oyun', 'bundle'],
    isActive: false,
  },
  {
    id: 'eurogamer',
    name: 'Eurogamer',
    url: 'https://www.eurogamer.net',
    rssUrl: 'https://www.eurogamer.net/?format=rss',
    lang: 'en',
    reliability: 4,
    categories: ['oyun', 'fırsat', 'ücretsiz oyun', 'inceleme'],
    isActive: false,
  },
  */
];

export function getActiveSources(): SourceConfig[] {
  return SOURCES.filter((s) => s.isActive);
}

export function getSourceById(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}
