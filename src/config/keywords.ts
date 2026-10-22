/**
 * AutoSocial — Anahtar Kelimeler ve Kara Liste Konfigürasyonu
 *
 * Niş: PC Donanım, Çevre Birimleri, Akıllı Telefon & Mobil Teknoloji, Oyun, Fırsatlar
 */

// ─── NİŞ ANAHTAR KELİMELER (Skor hesabında kullanılır) ─────────────────────
// İngilizce ve Türkçe terimler — hem başlık hem içerik taraması yapılır

export const NICHE_KEYWORDS = {
  // 1. Yapay Zeka (AI), LLM'ler & Açık Kaynak Modeller
  ai: [
    'ai ', 'yapay zeka', 'chatgpt', 'openai', 'gemini', 'gpt', 'gpt-4o', 'gpt-5', 'o1-preview', 'o3-mini',
    'copilot', 'claude', 'anthropic', 'midjourney', 'dall-e', 'stablediffusion', 'llama',
    'npu', 'tensor', 'machine learning', 'deep learning', 'yapay zekâ', 'yapayzeka',
    'deepseek', 'qwen', 'mistral', 'ollama', 'vllm', 'huggingface', 'open-source',
    'open source', 'açık kaynak', 'open-weights', 'fine-tuning', 'rag', 'agent', 'ai agent',
    'mcp', 'context window', 'reasoning model', 'opencode', 'glm', 'kimi',
    'whisper', 'flux', 'comfyui', 'llama.cpp', 'prompt engineering',
    'sonnet', 'opus', 'haiku', 'computer use', 'model context protocol', 'fable',
    'deepseek-v3', 'deepseek-r1', 'qwen2.5', 'llama 3', 'groq', 'cerebras', 'runpod',
    'synthetic data', 'reinforcement learning', 'rlhf', 'superintelligence', 'agi',
  ],

  // 2. Geliştirici & Builder Araçları, Açık Kaynak Ekosistemi
  builder: [
    'developer tool', 'dev tools', 'cli tool', 'github trending', 'open source',
    'açık kaynak', 'framework', 'library', 'compiler', 'runtime', 'docker', 'kubernetes',
    'wasm', 'webassembly', 'rustlang', 'typescript', 'golang', 'python', 'neovim',
    'terminal', 'api', 'sdk', 'backend', 'frontend', 'database', 'sqlite', 'postgres',
    'redis', 'graphql', 'rest api', 'microservices', 'self-hosted', 'homelab',
    'reverse engineering', 'modding', 'automation', 'scraper', 'bot', 'workflow',
    'git', 'linux', 'devops', 'ci/cd', 'github actions',
  ],

  // 3. Siber Güvenlik, Exploit, Jailbreak & Hack
  security: [
    'security', 'siber güvenlik', 'exploit', 'zero-day', '0-day', 'vulnerability',
    'güvenlik açığı', 'cve-', 'malware', 'ransomware', 'bypass', 'jailbreak',
    'reverse engineering', 'infosec', 'pentest', 'breach', 'leak', 'sızıntı',
    'backdoor', 'hacker', 'hacking', 'prompt injection', 'data breach', 'rootkit',
  ],

  // 4. Stratejik Teknoloji ve Mimari Analizleri
  tech: [
    'tech', 'teknoloji', 'datacenter', 'veri merkezi', 'ai chip', 'ai server',
    'tpu', 'supercomputer', 'quantum computing', 'asic', 'semiconductor',
    'yarı iletken', 'tsmc', 'silicon', 'silikon', 'model wars', 'ai compute',
  ],
} as const;

// Tüm anahtar kelimeleri düz bir diziye çevir
export const ALL_KEYWORDS: string[] = Object.values(NICHE_KEYWORDS).flat();

// ─── KATEGORİ → ANAHTAR KELİME GRUBU MAP ───────────────────────────────────
export type ArticleCategory =
  | 'ai'
  | 'builder'
  | 'security'
  | 'tech'
  // Geriye dönük uyumluluk (arşiv)
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
  if (hasKeywordMatch(text, NICHE_KEYWORDS.ai)) return 'ai';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.security)) return 'security';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.builder)) return 'builder';
  if (hasKeywordMatch(text, NICHE_KEYWORDS.tech)) return 'tech';

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
  builder:      { from: '#0d1b2a', to: '#1b263b' },   // Koyu lacivert-çelik mavi
  security:     { from: '#1a0808', to: '#2e0f0f' },   // Koyu kızıl-siyah (Hacker hissi)
  tech:         { from: '#0b132b', to: '#1c2541' },   // Derin mavi
  mobile:       { from: '#0d1322', to: '#1d2d50' },   // Koyu titanyum / gece mavisi
  general:      { from: '#111111', to: '#1a1a1a' },   // Nötr siyah
};
