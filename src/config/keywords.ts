/**
 * AutoSocial — Anahtar Kelimeler ve Kara Liste Konfigürasyonu
 *
 * Niş: PC Donanım, Çevre Birimleri, Akıllı Telefon & Mobil Teknoloji, Oyun, Fırsatlar
 */

// ─── NİŞ ANAHTAR KELİMELER (Skor hesabında kullanılır) ─────────────────────
// İngilizce ve Türkçe terimler — hem başlık hem içerik taraması yapılır

export const NICHE_KEYWORDS = {
  // İşlemci (CPU)
  cpu: [
    'cpu', 'processor', 'ryzen', 'core ultra', 'intel core', 'amd ryzen',
    'threadripper', 'epyc', 'xeon', 'işlemci', 'cpu test',
    'benchmark', 'tdp', 'ipc', 'cache', 'nm process', 'socket',
  ],

  // Ekran Kartı (GPU)
  gpu: [
    'gpu', 'graphics card', 'rtx', 'rx ', 'radeon', 'geforce', 'arc graphics',
    'vram', 'ekran kartı', 'ekran kartı testi', 'rasterization',
    'ray tracing', 'dlss', 'fsr', 'xess', 'shader', 'cuda', 'rdna', 'xe',
  ],

  // Bellek (RAM)
  ram: [
    'ddr5', 'ddr4', 'ram', 'memory', 'lpddr', 'cl timing',
    'bellek', 'dual channel', 'expo', 'xmp', 'mhz',
  ],

  // Depolama
  storage: [
    'nvme', 'ssd', 'pcie 5', 'pcie 4', 'm.2', 'nand', 'tlc', 'qlc',
    'sequential read', 'random write', 'depolama', 'hdd', 'nas',
  ],

  // Anakart
  motherboard: [
    'motherboard', 'anakart', 'chipset', 'x870', 'z890', 'b850',
    'am5', 'lga1851', 'vrm', 'pcie slot', 'bios',
  ],

  // Soğutma
  cooling: [
    'cooler', 'aio', 'liquid cooling', 'air cooling', 'thermal',
    'soğutma', 'radiator', 'heat pipe', 'tjunction', 'fan curve',
  ],

  // Çevre Birimleri
  peripherals: [
    'keyboard', 'mouse', 'monitor', 'headset', 'mousepad',
    'klavye', 'fare', 'monitör', 'kulaklık', '4k monitor', '240hz', '360hz',
    'ips', 'oled', 'qd-oled', 'response time', 'ghosting',
  ],

  // Güç Kaynağı
  psu: [
    'psu', 'power supply', 'güç kaynağı', '80+ gold', '80+ platinum',
    '80+ titanium', 'atx 3', 'watt', 'efficiency',
  ],

  // Kasa
  case_pc: [
    'pc case', 'kasa', 'chassis', 'airflow', 'tempered glass', 'itx', 'matx', 'atx',
  ],

  // Oyun Haberleri
  gaming: [
    'fps', 'gaming', 'game', 'oyun', 'benchmark', '1080p', '1440p', '4k gaming',
    'esports', 'competitive', 'frame time', 'stuttering', 'latency',
    'epic games', 'steam', 'valve', 'rockstar', 'gta', 'playstation', 'xbox', 'nintendo',
    'leak', 'sızıntı', 'trailer', 'fragman', 'duyuru', 'humble bundle', 'gog',
    'game pass', 'ps plus', 'prime gaming', 'weekly free',
  ],

  // Fırsatlar, İndirimler ve Ücretsiz Oyunlar
  deals: [
    'hot deal', 'daily deal', 'deal of the day', 'discount code', 'flash sale', 'price drop', 'special offer', 'limited offer',
    'indirim', 'fırsat', 'kampanya', 'indirimli satış', 'en ucuz', 'fiyat düşüşü', 'fiyat indirimi', 'uygun fiyat',
    'amazon deal', 'refurbished',
    // Ücretsiz oyun terimleri
    'free game', 'free to keep', 'free to play', 'free this week',
    'epic games free', 'epic free', 'claim free', 'giveaway',
    'humble bundle', 'humble free', 'steam free', 'free on steam',
    'price: free', '$0.00', 'bedava oyun', 'ücretsiz oyun', 'ücretsiz al',
    'epic games haftalık', 'steam bedava', 'g2a giveaway',
  ],

  // Sürücüler ve Yazılım
  software: [
    'driver', 'update', 'firmware', 'bios update', 'adrenaline',
    'game ready driver', 'studio driver', 'sürücü güncellemesi',
  ],

  // Yapay Zeka (AI)
  ai: [
    'ai ', 'yapay zeka', 'chatgpt', 'openai', 'gemini', 'gpt-4', 'gpt-5', 'gpt-6',
    'copilot', 'claude', 'anthropic', 'midjourney', 'dall-e', 'stablediffusion', 'llama',
    'npu', 'tensor', 'machine learning', 'deep learning', 'yapay zekâ', 'yapayzeka'
  ],

  // Akıllı Telefon & Mobil Teknoloji
  mobile: [
    'iphone', 'apple', 'ios', 'ipad', 'apple watch', 'airpods', 'vision pro',
    'samsung', 'galaxy', 'galaxy s', 'galaxy z', 'one ui', 'exynos',
    'smartphone', 'akıllı telefon', 'snapdragon', 'qualcomm', 'dimensity', 'mediatek',
    'xiaomi', 'redmi', 'hyperos', 'google pixel', 'pixel 9', 'pixel 8', 'android',
    'foldable', 'katlanabilir telefon', 'periscope camera', 'telephoto', 'hızlı şarj',
    'fast charging', 'bionic', 'a18', 'a17', 'apple silicon', 'huawei', 'honor', 'oneplus',
  ],
} as const;

// Tüm anahtar kelimeleri düz bir diziye çevir
export const ALL_KEYWORDS: string[] = Object.values(NICHE_KEYWORDS).flat();

// ─── KATEGORİ → ANAHTAR KELİME GRUBU MAP ───────────────────────────────────
export type ArticleCategory =
  | 'cpu'
  | 'gpu'
  | 'ram'
  | 'storage'
  | 'motherboard'
  | 'cooling'
  | 'peripherals'
  | 'psu'
  | 'case'
  | 'gaming'
  | 'deals'
  | 'software'
  | 'ai'
  | 'mobile'
  | 'general';

function hasKeywordMatch(text: string, keywords: readonly string[]): boolean {
  for (const kw of keywords) {
    if (kw.length <= 4) {
      const escaped = kw.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return true;
    } else {
      if (text.toLowerCase().includes(kw.toLowerCase())) return true;
    }
  }
  return false;
}

export function detectCategory(text: string): ArticleCategory {
  if (hasKeywordMatch(text, NICHE_KEYWORDS.gpu)) return 'gpu';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.cpu)) return 'cpu';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.mobile)) return 'mobile';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.ram)) return 'ram';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.storage)) return 'storage';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.motherboard)) return 'motherboard';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.cooling)) return 'cooling';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.peripherals)) return 'peripherals';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.psu)) return 'psu';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.case_pc)) return 'case';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.ai)) return 'ai';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.gaming)) return 'gaming';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.software)) return 'software';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.deals)) return 'deals';

  return 'general';
}

// ─── KARA LİSTE ─────────────────────────────────────────────────────────────

// Kara listedeki domain'ler — hiçbir içerik işlenmez
export const DOMAIN_BLACKLIST: string[] = [
  'clickbait.com',
  'spam-news.net',
];

// Başlıkta bu kelimeler varsa haber atlanır
export const KEYWORD_BLACKLIST: string[] = [
  // NSFW
  'porn', 'sex', 'adult', 'nsfw', 'nude',
  // Siyasi tartışma (nişimiz dışında)
  'politik', 'siyaset', 'seçim', 'hükümet',
  // Diğer
  'casino', 'gambling', 'crypto scam', 'nft scam',
  // Sitelerin kendi ücretli bülten / haftalık özet ve promosyon yazıları
  'this week on', 'weekly roundup', 'weekly digest', 'weekend digest',
  'newsletter', 'premium:', 'subscriber only', 'subscribers only',
];

// ─── KATEGORİ RENKLERİ (Sharp görsel üretiminde kullanılır) ─────────────────
export const CATEGORY_COLORS: Record<ArticleCategory, { from: string; to: string }> = {
  cpu:          { from: '#1a1a2e', to: '#16213e' },   // Koyu lacivert
  gpu:          { from: '#0d0d1a', to: '#1a0a2e' },   // Koyu mor
  ram:          { from: '#0a1628', to: '#0d2137' },   // Koyu mavi
  storage:      { from: '#1a1a0a', to: '#2a2a0d' },   // Koyu sarı-yeşil
  motherboard:  { from: '#1a0a0a', to: '#2e1616' },   // Koyu kırmızı
  cooling:      { from: '#0a1a1a', to: '#0d2e2e' },   // Koyu teal
  peripherals:  { from: '#1a0a1a', to: '#2e0d2e' },   // Koyu pembe
  psu:          { from: '#1a1200', to: '#2e2000' },   // Koyu turuncu
  case:         { from: '#141414', to: '#222222' },   // Koyu gri
  gaming:       { from: '#0a1a00', to: '#143300' },   // Koyu yeşil
  deals:        { from: '#1a0500', to: '#2e0d00' },   // Koyu turuncu-kırmızı
  software:     { from: '#001a1a', to: '#002e2e' },   // Koyu cyan
  ai:           { from: '#0f0c29', to: '#302b63' },   // Koyu lacivert-mor (Gelecekçi his)
  mobile:       { from: '#0d1322', to: '#1d2d50' },   // Koyu titanyum / gece mavisi
  general:      { from: '#111111', to: '#1a1a1a' },   // Nötr siyah
};
