/**
 * Teknoloji dünyasında sık geçen yabancı marka, model ve terimlerin
 * Türkçe TTS spikeri (tr-TR-AhmetNeural / tr-TR-EmelNeural) için fonetik telaffuz sözlüğü.
 *
 * AMAÇ:
 * 1. Spiker yabancı kelimeleri Türkçe heceleme kuralıyla bozmadan (örn: "Du-al-sen-se" yerine "Dualsens",
 *    "B-lü-e" yerine "Blu", "Riyzen" yerine "Rayzen") akıcı ve doğru okusun.
 * 2. Ekranda yanan Karaoke altyazıda (ASS/SRT) ise her zaman orijinal, havalı ve doğru yazım kalsın
 *    ("DualSense", "Ryzen 9", "Blue Yeti").
 */

// Küçük harf anahtarlar -> AhmetNeural için fonetik okunuş
export const PRONUNCIATION_DICT: Record<string, string> = {
  // Konsol & Oyun
  dualsense: 'Dualsens',
  dualshock: 'Dualşok',
  playstation: 'Pleysiteyşın',
  xbox: 'İksbaks',
  nintendo: 'Nintendo',
  switch: 'Siviç',
  joycon: 'Coykon',
  'joy-con': 'Coykon',
  gamepass: 'Geympes',
  gameplay: 'Geympley',
  steam: 'Sıtiim',
  gamer: 'Geymır',
  streamer: 'Sıtrimır',

  // İşlemci, Ekran Kartı & Donanım
  ryzen: 'Rayzen',
  geforce: 'Cifors',
  radeon: 'Radeon',
  rtx: 'Artieks',
  gtx: 'Citieks',
  intel: 'İntel',
  core: 'Kor',
  chipset: 'Çipset',
  socket: 'Soket',
  benchmark: 'Bençmark',
  hardware: 'Hardveyr',
  software: 'Softveyr',
  tflops: 'Teraflops',
  fps: 'Efpies',
  dlss: 'Diyeleses',
  'dlss-nr': 'Diyelesesenar',
  fsr: 'Efesar',
  vram: 'Virem',
  overclock: 'Ovırklok',
  ghz: 'Cigahörts',
  mhz: 'Megahörts',
  pcie: 'Pisiayi',
  nvme: 'Enviemi',
  ssd: 'Essesdi',
  ddr5: 'Didiyar beş',
  ddr4: 'Didiyar dört',
  oled: 'Oled',
  qled: 'Kuled',

  // Çevre Birimleri & Ses
  blue: 'Blu',
  yeti: 'Yeti',
  logitech: 'Lojitek',
  razer: 'Reyzır',
  corsair: 'Korseyr',
  steelseries: 'Stilseris',
  wireless: 'Vayırlıs',
  bluetooth: 'Bulutut',
  headset: 'Hedset',
  mouse: 'Maus',
  touchpad: 'Taçped',
  earbuds: 'İrbads',
  airpods: 'Eyrpods',
  soundbar: 'Saundbar',

  // Mobil & Markalar
  apple: 'Epıl',
  iphone: 'Ayfon',
  ipad: 'Ayped',
  macbook: 'Mekbuk',
  watch: 'Voç',
  smartwatch: 'Sımartvoç',
  samsung: 'Samsung',
  galaxy: 'Galaksi',
  ultra: 'Ultra',
  pro: 'Puro',
  max: 'Meks',
  plus: 'Pılas',
  pixel: 'Piksel',
  xiaomi: 'Şaomi',
  huawei: 'Huavey',

  // Genel Teknoloji & Terimler
  pos: 'Pos',
  leak: 'Liik',
  update: 'Apdêt',
  online: 'Onlayn',
  offline: 'Oflayn',
  setup: 'Setap',
  review: 'Rivyuv',
  thread: 'Tıred',
  displayport: 'Displeyport',
  youtube: 'Yutub',
  twitter: 'Tvittır',
  instagram: 'İnstagram',
  reddit: 'Redit',
  discord: 'Diskord',
};

export const REVERSE_PRONUNCIATION_DICT: Record<string, string> = {
  // Konsol & Oyun
  dualsens: 'DualSense',
  dualşok: 'DualShock',
  pleysiteyşın: 'PlayStation',
  iksbaks: 'Xbox',
  siviç: 'Switch',
  geympes: 'Game Pass',
  sıtiim: 'Steam',

  // Donanım, İşlemci & Ekran Kartı
  rayzen: 'Ryzen',
  cifors: 'GeForce',
  blu: 'Blue',
  artieks: 'RTX',
  citieks: 'GTX',
  diyeleses: 'DLSS',
  diyelesesenar: 'DLSS-NR',
  efesar: 'FSR',
  virem: 'VRAM',
  pisiayi: 'PCIe',
  enviemi: 'NVMe',
  essesdi: 'SSD',
  didiyar: 'DDR',
  'didiyar beş': 'DDR5',
  'didiyar dört': 'DDR4',
  teraflops: 'TFLOPS',
  efpies: 'FPS',
  bençmark: 'Benchmark',
  hardveyr: 'Hardware',
  softveyr: 'Software',

  // Çevre Birimleri & Ses
  vayırlıs: 'Wireless',
  bulutut: 'Bluetooth',
  lojitek: 'Logitech',
  reyzır: 'Razer',
  korseyr: 'Corsair',
  stilseris: 'SteelSeries',
  taçped: 'Touchpad',
  hedset: 'Headset',
  irbads: 'Earbuds',

  // Mobil & Markalar
  epıl: 'Apple',
  ayfon: 'iPhone',
  ayped: 'iPad',
  mekbuk: 'MacBook',
  eyrpods: 'AirPods',
  sımartvoç: 'Smartwatch',
  galaksi: 'Galaxy',
  puro: 'Pro',
  pılas: 'Plus',
  meks: 'Max',
  şaomi: 'Xiaomi',
  huavey: 'Huawei',
};

export interface PhoneticPreparedResult {
  spokenText: string;
  originalTokens: string[];
}

/**
 * Verilen metindeki yabancı terimleri Türkçe TTS spikerinin doğru okuyabilmesi için
 * fonetik karşılıklarıyla değiştirir, ancak altyazıda kullanılacak orijinal kelimeleri saklar.
 */
export function preparePhoneticScript(text: string): PhoneticPreparedResult {
  if (!text) {
    return { spokenText: '', originalTokens: [] };
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  const spokenTokens: string[] = [];

  for (const token of tokens) {
    // Kelime başı/sonu noktalama ve ekleri ayır (örn: "DualSense'in," -> prefix: "", core: "DualSense", suffix: "'in,")
    const match = token.match(/^([^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]*)(.*?)([^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]*)$/);
    if (!match) {
      spokenTokens.push(token);
      continue;
    }

    const [_, prefix, core, suffix] = match;

    // Kesme işareti ile ayrılmış ek varsa (örn: DualSense'in -> base: DualSense, apostropheSuffix: 'in)
    const apostropheIdx = core.indexOf("'");
    let baseWord = core;
    let extraSuffix = '';

    if (apostropheIdx > 0) {
      baseWord = core.substring(0, apostropheIdx);
      extraSuffix = core.substring(apostropheIdx);
    }

    const lowerBase = baseWord.toLowerCase();

    if (PRONUNCIATION_DICT[lowerBase]) {
      const phonetic = PRONUNCIATION_DICT[lowerBase];
      spokenTokens.push(`${prefix}${phonetic}${extraSuffix}${suffix}`);
    } else if (lowerBase.includes('-')) {
      // "DLSS-NR" gibi tireli bileşik terimleri kontrol et
      const parts = lowerBase.split('-');
      const translated = parts.map((p) => PRONUNCIATION_DICT[p] || p);
      if (translated.some((t, idx) => t !== parts[idx])) {
        // Altyazı kelime eşleşmesini 1-e-1 korumak ve duraksamayı önlemek için tek parça birleştir
        spokenTokens.push(`${prefix}${translated.join('')}${extraSuffix}${suffix}`);
      } else {
        spokenTokens.push(token);
      }
    } else {
      spokenTokens.push(token);
    }
  }

  return {
    spokenText: spokenTokens.join(' '),
    originalTokens: tokens,
  };
}

/**
 * Altyazıdaki bir kelimenin orijinal şık halini garanti altına alır.
 * Eğer fonetik bir kelime sızdıysa ("dualsens"), onu derhal orijinaline ("DualSense") çevirir.
 */
export function restoreDisplayWord(word: string, fallbackOriginal?: string): string {
  if (fallbackOriginal && fallbackOriginal.trim().length > 0) {
    // Orijinal kelimenin noktalama işaretlerini ayıkla
    const cleanOrig = fallbackOriginal.replace(/^[^\wığüşöçİĞÜŞÖÇ]+|[^\wığüşöçİĞÜŞÖÇ]+$/g, '');
    if (cleanOrig.length > 0) {
      return cleanOrig;
    }
    return fallbackOriginal;
  }

  const lower = word.toLowerCase().replace(/^[^\wığüşöçİĞÜŞÖÇ]+|[^\wığüşöçİĞÜŞÖÇ]+$/g, '');
  if (REVERSE_PRONUNCIATION_DICT[lower]) {
    return REVERSE_PRONUNCIATION_DICT[lower]!;
  }

  return word;
}
