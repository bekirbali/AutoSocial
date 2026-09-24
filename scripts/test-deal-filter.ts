import { isForeignDeal } from '../src/modules/processor/dealFilter.js';
import { filterArticle } from '../src/modules/processor/filter.js';
import { scoreArticle } from '../src/modules/processor/scorer.js';
import { detectCategory } from '../src/config/keywords.js';
import type { FetchedItem } from '../src/modules/fetcher/rss.js';

const testCases: Array<{
  name: string;
  item: FetchedItem;
  shouldBeFiltered: boolean;
  expectedScoreZero: boolean;
}> = [
  {
    name: '1. Newegg 9800X3D Combo (User Screenshot Case)',
    item: {
      url: 'https://www.tomshardware.com/pc-components/get-an-amd-ryzen-7-9800x3d-for-only-usd320-2-item-newegg-combo-saves-usd149-and-nets-one-of-the-fastest-gaming-cpus-and-a-quality-msi-x870e-motherboard-for-only-usd578',
      title: 'Get an AMD Ryzen 7 9800X3D for only $320 — 2-item Newegg combo saves $149 and nets one of the fastest gaming CPUs and a quality MSI X870E motherboard for only $578',
      summary: "Newegg's 2-item combo pairs the Ryzen 7 9800X3D with MSI X870E Gaming Max Wifi motherboard for only $578 - the $149 savings makes this the cheapest way into the AM5 platform with one of the fastest gaming CPUs around.",
      publishedAt: new Date(),
      sourceId: 'tomshardware',
      sourceName: "Tom's Hardware",
      lang: 'en',
    },
    shouldBeFiltered: true,
    expectedScoreZero: true,
  },
  {
    name: '2. Newegg 4-item Build Combo (Save $240)',
    item: {
      url: 'https://www.tomshardware.com/pc-components/save-usd240-on-a-four-item-gaming-build-combo-from-newegg-usd1-113-buys-a-ryzen-7-9800x3d-32gb-of-corsair-ddr5-ram-a-gigabyte-x870e-motherboard-plus-a-free-240mm-aio-and-amd-game-bundle',
      title: 'Save $240 on a four-item gaming build combo from Newegg – $1,113 buys a Ryzen 7 9800X3D, 32GB of Corsair DDR5 RAM, a Gigabyte X870E Motherboard, plus a free 240mm AIO and AMD game bundle',
      summary: "This Newegg 3-item bundle pairs the fast, gaming-focused Ryzen 7 9800X3D with 32GB of Corsair Vengeance DDR5-6000 RAM and a Gigabyte X870E Aorus Pro board for only $1,113.99. That's a $240 savings, plus two freebies, making this one of the better combo deals available right now.",
      publishedAt: new Date(),
      sourceId: 'tomshardware',
      sourceName: "Tom's Hardware",
      lang: 'en',
    },
    shouldBeFiltered: true,
    expectedScoreZero: true,
  },
  {
    name: '3. UK Pricing Low (7800X3D £265)',
    item: {
      url: 'https://overclock3d.net/news/cpu_mainboard/amd-ryzen-7-7800x3d-hits-a-new-uk-pricing-low/',
      title: 'AMD Ryzen 7 7800X3D hits a new UK pricing low',
      summary: 'AMD’s Ryzen 7 7800X3D has received a limited-time price drop in the UK, bringing the CPU down to £265. At this price, it offers much better value for money than AMD’s newer Ryzen 7 9800X3D gaming CPU.',
      publishedAt: new Date(),
      sourceId: 'overclock3d',
      sourceName: 'OC3D',
      lang: 'en',
    },
    shouldBeFiltered: true,
    expectedScoreZero: true,
  },
  {
    name: '4. Corsair RAM ($115 saving)',
    item: {
      url: 'https://www.techradar.com/computing/memory/ram-prices-are-ridiculous-so-ill-take-this-usd115-saving-on-corsairs-32gb-ddr5-6000-cl30-memory-kit',
      title: "RAM prices are ridiculous, so I'll take this $115 saving on Corsair's 32GB DDR5-6000 CL30 memory kit",
      summary: 'Memory prices are ridiculous right now, but this 32GB Corsair DDR5-6000 RAM deal knocks $115 off the price at Newegg.',
      publishedAt: new Date(),
      sourceId: 'techradar',
      sourceName: 'TechRadar',
      lang: 'en',
    },
    shouldBeFiltered: true,
    expectedScoreZero: true,
  },
  {
    name: '5. TeamGroup RAM Newegg promo code ($820)',
    item: {
      url: 'https://www.techradar.com/pro/this-teamgroup-t-force-64gb-ddr5-6000-memory-kit-is-built-for-serious-pro-workloads-and-content-creation-and-neweggs-promo-code-drops-it-to-usd820',
      title: "This TeamGroup T-Force 64GB DDR5-6000 memory kit is built for serious pro workloads and content creation — and Newegg's promo code drops it to $820",
      summary: 'Built for creators, streamers, and multi-tasking pros, TeamGroup memory kit drops to $820 with code.',
      publishedAt: new Date(),
      sourceId: 'techradar',
      sourceName: 'TechRadar',
      lang: 'en',
    },
    shouldBeFiltered: true,
    expectedScoreZero: true,
  },
  {
    name: '6. ASRock Monitor Labor Day Sale (Under $300)',
    item: {
      url: 'https://www.techradar.com/pro/asrock-27-inch-oled-monitor-for-content-creators-just-dropped-to-under-usd300-in-neweggs-labor-day-sale',
      title: 'ASRock 27-inch OLED monitor for content creators just dropped to under $300 in Newegg’s Labor Day sale',
      summary: "Photo and video editors can save $165 on this 27-inch OLED ASRock Phantom monitor in Newegg's Labor Day Sale.",
      publishedAt: new Date(),
      sourceId: 'techradar',
      sourceName: 'TechRadar',
      lang: 'en',
    },
    shouldBeFiltered: true,
    expectedScoreZero: true,
  },
  // ─── GEÇMESİ GEREKEN MEŞRU HABERLER ─────────────────────────────────────────
  {
    name: '7. Legit CPU Launch ($479 MSRP - NOT a store deal)',
    item: {
      url: 'https://www.anandtech.com/amd-ryzen-7-9800x3d-launch-specs-benchmarks',
      title: 'AMD Ryzen 7 9800X3D officially launched with $479 MSRP, 8 cores and 5.2 GHz boost',
      summary: 'AMD has officially launched its flagship gaming processor featuring second-generation 3D V-Cache with a base clock of 4.7 GHz and 120W TDP.',
      publishedAt: new Date(),
      sourceId: 'tomshardware',
      sourceName: "Tom's Hardware",
      lang: 'en',
    },
    shouldBeFiltered: false,
    expectedScoreZero: false,
  },
  {
    name: '8. Legit GPU Announcement ($999 price tag)',
    item: {
      url: 'https://www.techpowerup.com/nvidia-geforce-rtx-5080-revealed',
      title: 'NVIDIA GeForce RTX 5080 revealed with 16GB GDDR7, $999 price tag',
      summary: 'NVIDIA CEO announced the upcoming Blackwell architecture featuring next generation ray tracing and DLSS 4 technology.',
      publishedAt: new Date(),
      sourceId: 'techpowerup',
      sourceName: 'TechPowerUp',
      lang: 'en',
    },
    shouldBeFiltered: false,
    expectedScoreZero: false,
  },
  {
    name: '9. Legit AI News (OpenAI offering - shouldn\'t be deal)',
    item: {
      url: 'https://www.theverge.com/tech/mozilla-open-weight-ai-report',
      title: "China's open-weight AI models are now just 4 months behind frontier US offerings, Mozilla report claims",
      summary: 'A new comprehensive report compares open weights models against proprietary models across multiple coding and reasoning benchmarks.',
      publishedAt: new Date(),
      sourceId: 'theverge_tech',
      sourceName: 'The Verge',
      lang: 'en',
    },
    shouldBeFiltered: false,
    expectedScoreZero: false,
  },
  {
    name: '10. Legit Turkish Giveaway (Epic Games TR)',
    item: {
      url: 'https://www.donanimhaber.com/epic-games-ucretsiz-oyunlar-bu-hafta--180000',
      title: 'Epic Games iki oyunu birden ücretsiz yaptı: Almak için 7 gün var',
      summary: 'Epic Games Store bu hafta iki popüler yapımı tamamen bedava dağıtıyor. Kütüphanenize ekleyip kalıcı olarak sahip olabilirsiniz.',
      publishedAt: new Date(),
      sourceId: 'donanimhaber',
      sourceName: 'DonanımHaber',
      lang: 'tr',
    },
    shouldBeFiltered: false,
    expectedScoreZero: false,
  },
];

console.log('=== DEAL FILTER & SCORING VERIFICATION ===\n');

let allPassed = true;

for (const tc of testCases) {
  const isDeal = isForeignDeal(tc.item);
  const filterRes = filterArticle(tc.item);
  const scoreRes = scoreArticle(tc.item, 5);
  const category = detectCategory(tc.item.title + ' ' + (tc.item.summary ?? ''));

  const filterPassedExpected = tc.shouldBeFiltered ? !filterRes.passed : filterRes.passed;
  const scoreZeroExpected = tc.expectedScoreZero ? scoreRes.total === 0 : scoreRes.total > 0;

  const passed = filterPassedExpected && scoreZeroExpected;
  if (!passed) allPassed = false;

  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${tc.name}`);
  console.log(`   isForeignDeal: ${isDeal}`);
  console.log(`   filterPassed:  ${filterRes.passed} (reason: ${filterRes.reason ?? 'none'})`);
  console.log(`   score:         ${scoreRes.total}`);
  console.log(`   category:      ${category}`);
  console.log('');
}

if (allPassed) {
  console.log('🎉 ALL 10 TESTS PASSED PERFECTLY!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!');
  process.exit(1);
}
