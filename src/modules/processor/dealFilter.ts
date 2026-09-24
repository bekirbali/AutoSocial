import { createLogger } from '../../lib/logger.js';

const log = createLogger('processor:dealFilter');

/**
 * Yabancı perakende mağazaları (Sadece ABD/Avrupa pazarına özel satış yapan zincirler)
 * Bu mağazaların geçtiği donanım haberleri %99.9 oranında yerel mağaza indirim/fırsat içeriğidir.
 */
const FOREIGN_RETAILERS = [
  'newegg',
  'best buy',
  'micro center',
  'microcenter',
  'b&h photo',
  'b&h',
  'currys',
  'mindfactory',
  'overclockers uk',
  'adorama',
  'walmart',
  'target',
  'costco',
];

/**
 * Yabancı dildeki (EN / DE) fırsat, indirim, promosyon kelimeleri.
 * Kelime kökleri ve türevleri (saves, savings, cheaper, combos vb.) dahildir.
 */
const DEAL_TERMS_REGEX =
  /\b(deals?|sales?|discounts?|discounted|clearance|giveaways?|doorbuster|bargains?|steals?|blowout|saves?|saving|savings|saved|combos?|bundles?|promo codes?|coupons?|rebates?|cashback|cash back|vouchers?|cheaper|cheapest|price drops?|price cuts?|price slashes?|pricing low|pricing drops?|lowest price|record low|all-time low|historic low|rabatt|angebote|schnäppchen|gratis)\b/i;

/**
 * Dolar, Euro, Sterlin bazlı net indirim ve fiyat düşüşü regex kalıpları:
 * - "saves $149", "save $240", "saving $115"
 * - "$149 off", "$115 saving", "£50 discount"
 * - "for only $320", "now only $299", "down to £265", "drops to $578", "under $300", "$1,113 buys a"
 * - "% off" (örn: "20% off")
 */
const CURRENCY_DEAL_PATTERNS = [
  /%\s*off\b/i,
  /(?:save|saves|saving|savings|saved)\s*[\$£€]\d+/i,
  /[\$£€]\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:off|savings?|discount|drop|cut|rebate|voucher|promo)\b/i,
  /(?:for only|now only|down to|drops? to|slashed to|under|just|buys? (?:a|an)?)\s*[\$£€]\d+/i,
  /[\$£€]\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:combo|bundle|deal|promo)\b/i,
  /\b(?:drops?|slashed|cuts?)\s+(?:to|by)\s+[\$£€]\d+/i,
];

export interface ArticleForDealCheck {
  title: string;
  summary?: string | null;
  url?: string;
  lang?: string;
}

/**
 * Yabancı kaynaklı (EN / DE) içeriklerin Türkiye'de geçerliliği olmayan
 * dolar/euro/sterlin bazlı perakende indirim veya kombo fırsatı olup olmadığını denetler.
 *
 * Türkçe içerikler (TR) bu kontrolden muaftır (örn. Epic Games haftalık ücretsiz oyunları).
 */
export function isForeignDeal(item: ArticleForDealCheck): boolean {
  // Yalnızca yabancı dildeki haberler elenir
  if (item.lang === 'tr') {
    return false;
  }

  const title = item.title || '';
  const summary = item.summary || '';
  const url = item.url || '';
  const fullText = `${title} ${summary}`.toLowerCase();
  const titleAndUrl = `${title} ${url}`.toLowerCase();

  // 1. Yabancı perakendeci mağaza kontrolü (Başlık, özet veya URL)
  const matchedRetailer = FOREIGN_RETAILERS.find(
    (retailer) =>
      titleAndUrl.includes(retailer) ||
      (fullText.includes(retailer) && DEAL_TERMS_REGEX.test(fullText)),
  );
  if (matchedRetailer) {
    log.debug(
      { title, retailer: matchedRetailer },
      `Yabancı perakendeci tespit edildi: ${matchedRetailer}`,
    );
    return true;
  }

  // 2. Fiyat & Döviz indirim kalıpları (saves $149, for only $320, % off vb.)
  for (const pattern of CURRENCY_DEAL_PATTERNS) {
    if (pattern.test(fullText)) {
      log.debug({ title, pattern: pattern.toString() }, 'Dövizli indirim kalıbı eşleşti');
      return true;
    }
  }

  // 3. Genel indirim ve promosyon kelimeleri (Özellikle başlıkta geçiyorsa doğrudan elenir)
  if (DEAL_TERMS_REGEX.test(title)) {
    log.debug({ title }, 'Başlıkta fırsat/indirim terimi tespit edildi');
    return true;
  }

  // 4. URL yolu kontrolü (Örn: /deals/, /sales/, -combo-, -deal-)
  if (/\/(?:deals?|sales?)\/|-(?:deal|deals|combo|discount)-/i.test(url)) {
    log.debug({ url }, 'URL indirim/fırsat segmenti içeriyor');
    return true;
  }

  return false;
}
