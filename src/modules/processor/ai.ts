import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import type { ArticleCategory } from '../../config/keywords.js';

const log = createLogger('processor:ai');

// Gemini istemcisi — modüle yüklendiğinde bir kez başlatılır
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(env.GEMINI_API_KEY);
const flashModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

export interface TweetGenerationResult {
  tweetText: string;
  imageHook: string;
  translatedTitle: string;
  impactScore: number;
  impactReason?: string;
  hashtags: string[];
  tone: string;
  isThread: boolean;
  threadTweets?: string[];
}

export interface InstagramCaptionResult {
  caption: string;
  translatedTitle: string;
  hashtags: string[];
  tone: string;
}

export interface ReelsScriptSegment {
  articleIndex: number;
  headline: string;
  script: string;
}

export interface ReelsScriptResult {
  spokenScript: string;
  hookTitle: string;
  segments: ReelsScriptSegment[];
  outroScript: string;
}

/**
 * Kategori bazlı odak ve kanca rehberleri
 */
const CATEGORY_GUIDES: Record<ArticleCategory, { angle: string; hookHint: string }> = {
  cpu:         { angle: 'İşlemci performansı, mimari yenilikler, benchmark sonuçları ve pazar dengesi', hookHint: 'performans sıçraması, çekirdek/IPC farkı veya rakibe meydan okuma' },
  gpu:         { angle: 'FPS artışı, VRAM kapasitesi, güç tüketimi ve fiyat/performans', hookHint: 'oyuncuların FPS/fiyat dengesi, mimari kırılma veya yeni teknolojiler' },
  ram:         { angle: 'DDR5 frekansları, gecikme süreleri (CL) ve sistem stabilitesi', hookHint: 'hız ve kararlılık sınırları' },
  storage:     { angle: 'PCIe 5 okuma/yazma hızları, depolama ömrü ve fiyat düşüşleri', hookHint: 'hız veya kapasite/fiyat fırsatı' },
  motherboard: { angle: 'VRM kalitesi, yeni soket/chipset özellikleri ve PCIe hatları', hookHint: 'yeni sistem kuracakların gözden kaçırmaması gereken detay' },
  cooling:     { angle: 'Sıvı/hava soğutma performansı, termal verimlilik ve sessizlik', hookHint: 'yüksek sıcaklıklara kesin çözüm' },
  peripherals: { angle: 'OLED/240Hz+ monitörler, gecikmesiz fare/klavye ve ergonomi', hookHint: 'oyun veya çalışma deneyimini değiştiren donanım' },
  psu:         { angle: 'ATX 3.0/3.1 standartları, güç güvenliği ve verimlilik', hookHint: 'yeni nesil sistemlerin güç gereksinimi' },
  case:        { angle: 'Hava akışı (airflow), kablo yönetimi ve kompakt tasarım', hookHint: 'estetik ve soğutma dengesi' },
  gaming:      { angle: 'Oyun performansı, motor optimizasyonları ve sektörün büyük kırılmaları', hookHint: 'oyun dünyasında taşları yerinden oynatan gelişme' },
  deals:       { angle: 'Kaçırılmayacak fiyat düşüşü ve fiyat/performans oranı', hookHint: 'nadir görülen dip fiyat fırsatı' },
  software:    { angle: 'Sürücü güncellemeleri, optimizasyon yamaları ve açık kaynak araçlar', hookHint: 'sistem performansını doğrudan artıran yazılım adımı' },
  ai:          { angle: 'Açık kaynak modeller (DeepSeek, Llama, Qwen), yerel LLM araçları, developer kütüphaneleri, API maliyetleri/kısıtları ve model savaşları', hookHint: 'ücretsiz/açık kaynak alternatif, yerel çalıştırma avantajı veya geliştiricinin cebini/işini kurtaran hamle' },
  mobile:      { angle: 'Kamera yetenekleri, işlemci (Apple Silicon/Snapdragon) performansı, pil/şarj ömrü, yapay zeka özellikleri ve kullanıcı deneyimi', hookHint: 'akıllı telefon pazarındaki rekabet, kamera devrimi veya günlük kullanımı değiştiren yeni özellikler' },
  general:     { angle: 'Teknoloji ekosistemi, donanım endüstrisi ve geleceğin standartları', hookHint: 'sektörün geleceğini şekillendiren kritik gelişme' },
};

/**
 * Gemini ile Türkçe yüksek etkileşimli küratör tweeti üret
 * Format: Kanca + Haber + 💡 Cebe/İşe Etkisi + 💬 Tartışma Sorusu
 */
export async function generateTweet(
  title: string,
  summary: string | undefined,
  sourceName: string,
  category: ArticleCategory,
  videoPath?: string,
): Promise<TweetGenerationResult> {
  const guide = CATEGORY_GUIDES[category] || CATEGORY_GUIDES.general;
  const sourceInfo = summary ? `\n\nİçerik Detayları: ${summary.substring(0, 450)}` : '';

  const prompt = `Sen "TeknoFiltre" markasının kurucusu, bağımsız, samimi ve yapay zeka, açık kaynak modeller, geliştirici araçları ile teknoloji dünyasını çok iyi bilen kıdemli bir builder/teknoloji küratörüsün. Sloganın: "Gereksizi eliyorum, ne işe yarar onu yazıyorum."

GÖREV: Aşağıdaki içeriği analiz et ve X'te (Twitter) kesinlikle yapay zeka kokmayan, sanki işi bilen bir insan editör yazmış gibi duran, yüksek etkileşimli TAM OLARAK 2 PARAGRAFLI bir tweet hazırla.

HABER BAŞLIĞI: ${title}
KAYNAK: ${sourceName}${sourceInfo}
KATEGORİ ODAĞI: ${guide.angle} (${guide.hookHint})

KRİTİK FORMAT VE ÜSLUP KURALLARI:
Tweet istisnasız ve tam olarak 2 PARAGRAFTAN oluşmalı, iki paragraf arasında tek bir satır boşluk (\n\n) bulunmalıdır:

1. PARAGRAF - VURUCU KANCA (Tek Cümle):
Akışta kaydırmayı anında durduran, merak uyandıran veya ezber bozan tek cümlelik çarpıcı bir tespit / kanca.

2. PARAGRAF - DETAY VE ETKİ AÇIKLAMASI (Kısa & Doğal Anlatım):
Haberin ne olduğunu (somut verilerle: model, fiyat, FPS, watt vb.) ve son kullanıcıya / tüketiciye ne getirdiğini tek bir akıcı metin olarak özetle. Kuru ajans dilini ("duyuruldu", "açıklandı") KESİNLİKLE KULLANMA. İsteğe göre cümlenin sonunu samimi ve doğal bir soruyla veya net bir kişisel yorumla bağlayabilirsin.

KESİN YASAKLAR (YAPAY ZEKA VE KALIP YASAKLARI):
- YAPAY BAĞLAÇLAR KESİNLİKLE YASAKTIR: "Kısacası", "Yani özetle", "Bu da pratikte", "Özetle", "Sonuç olarak", "Bu durum", "Bu gelişme" gibi yapay zeka kalıplarını ASLA KULLANMA. Cümleye doğrudan, organik ve insan gibi gir.
- EMOJİ KİRLİLİĞİ VE İKONLAR YASAKTIR: Metin içinde "💡", "💬", "👇", "🚀", "⚡️" gibi robotik yapay zeka emojileri KULLANMA. Metin tamamen doğal insan yazısı gibi durmalıdır.
- ETİKET YASAKTIR: "Cebe Etkisi:", "Özet:", "Yorum:", "Haber:" gibi başlık kalıpları yazma.
- PARAGRAF SINIRI: Metin kesinlikle 3 veya 4 paragrafa bölünmemeli, tam olarak 2 paragraf olmalıdır.
- KARAKTER SINIRI: Tweet maksimum 270 karakter olmalıdır.
- HASHTAG KESİNLİKLE YASAKTIR (# sembolü kullanma).
- THREAD/FLOOD YASAKTIR ("detaylar aşağıda", "devamı yorumda" gibi kalıplar yasaktır).
- GÖRSEL İÇİN KANCA (imageHook): Görselin üzerine basılacak en fazla 3-5 KELİMELİK dev, vurucu bir kanca (Örn: "Orta Segmente Amiral Gemisi Gücü", "1000 Dolar Altı Devrim").
- TÜKETİCİ ETKİ PUANI (impactScore 1-10): Haberin tüketici cebine/hayatına etkisi (1-10).

ÇIKTI FORMATI (YALNIZCA GEÇERLİ JSON):
{
  "tweetText": "[Vurucu Kanca]\n\n[Detay, etki ve doğal kapanışı içeren açıklama paragrafı]",
  "imageHook": "En fazla 3-5 kelimelik dev kanca",
  "translatedTitle": "Kısa Türkçe başlık (maks 55 karakter)",
  "impactScore": 8,
  "impactReason": "Tüketiciye etkisi...",
  "tone": "samimi editör"
}

Sadece JSON döndür.`;

  try {
    log.debug({ title, category, hasVideo: !!videoPath }, 'Gemini tweet üretiliyor');

    let contentArgs: any[] = [prompt];
    
    if (videoPath) {
      log.info('Video Gemini\'ye yükleniyor...');
      const uploadResult = await fileManager.uploadFile(videoPath, {
        mimeType: 'video/mp4',
        displayName: 'TeknoFiltre Video',
      });
      
      contentArgs = [
        prompt,
        {
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: uploadResult.file.mimeType,
          },
        },
      ];
    }

    const result = await flashModel.generateContent(contentArgs);
    const responseText = result.response.text().trim();

    // JSON parse et
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini geçersiz JSON döndürdü');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      tweetText: string;
      imageHook?: string;
      translatedTitle?: string;
      impactScore?: number;
      impactReason?: string;
      tone?: string;
    };

    // Güvenlik kontrolleri ve AI kalıntı temizliği
    let tweetText = sanitizeTweetText(parsed.tweetText);
    
    // Robotik etiket ve emoji kaçaklarını temizle
    tweetText = tweetText
      .replace(/[💡💬📌🚀⚡️]/g, '')
      .replace(/\s*(Bizim Yorumumuz|Cebe Etkisi|Özet|Yorum):\s*/gi, ' ')
      .replace(/\b(kısacası|yani özetle|bu da pratikte|özetle)\b[,:]?\s*/gi, '')
      .replace(/\s*detaylar\s+(zincirde|aşağıda|flood'da|yorumda|yorumlarda)[.!?\s👇]*/gi, '')
      .replace(/\s*devamı\s+(zincirde|aşağıda|flood'da|yorumda|yorumlarda)[.!?\s👇]*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const hashtags: string[] = []; // Hashtag'ler tamamen kaldırıldı

    // Karakter uzunluğu kontrolü
    if (tweetText.length > 280) {
      log.warn(
        { length: tweetText.length, title },
        'Tweet metni 280 sınırı için güvenli sınıra alınıyor',
      );
    }

    const finalTweet = tweetText.substring(0, 280);
    const imageHook = (parsed.imageHook || parsed.translatedTitle || title).replace(/[#*`]/g, '').trim();

    log.info(
      { title, category, tweetLength: finalTweet.length, impactScore: parsed.impactScore, imageHook },
      'Tweet üretildi',
    );

    return {
      tweetText: finalTweet,
      imageHook,
      translatedTitle: parsed.translatedTitle || title,
      impactScore: parsed.impactScore ?? 7,
      impactReason: parsed.impactReason,
      hashtags,
      tone: parsed.tone ?? 'küratör',
      isThread: false,
      threadTweets: undefined,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ err: errMsg, title }, 'Gemini tweet üretimi başarısız');
    throw new Error(`AI tweet üretimi başarısız: ${errMsg}`);
  }
}

/**
 * Gemini 3.6 Flash ile Türkçe Instagram Caption üret
 *
 * @param title - Orijinal haber başlığı (EN veya TR)
 * @param summary - Haber özeti (varsa)
 * @param sourceName - Kaynak adı
 * @param category - Haber kategorisi (prompt template seçimi için)
 */
export async function generateInstagramCaption(
  title: string,
  summary: string | undefined,
  sourceName: string,
  category: ArticleCategory,
  videoPath?: string,
): Promise<InstagramCaptionResult> {
  const guide = CATEGORY_GUIDES[category] || CATEGORY_GUIDES.general;
  const sourceInfo = summary ? `\n\nÖzet: ${summary.substring(0, 400)}` : '';
  
  const selectedTone = 'bilgilendirici ve etkileşim odaklı';

  const prompt = `Sen bir PC donanım ve teknoloji haber hesabının sosyal medya editörüsün.
Aşağıdaki haber için Instagram'a uygun, takipçilerle etkileşim kuran Türkçe bir açıklama (caption) yaz.

HABER BAŞLIĞI: ${title}
KAYNAK: ${sourceName}${sourceInfo}

KURALLAR:
1. Metin Türkçe olmalı (başlık İngilizce veya Almanca gibi yabancı dillerde olsa bile Türkçe'ye çevir ve özetle).
2. Metin uzun olabilir, detayları okuyucuya sıkmadan aktar (2-3 paragraf olabilir).
3. "X dünyasında son dakika:", "Y konusunda gelişme:" gibi robotik giriş kalıplarını KULLANMA. İnsansı ve direkt bir giriş yap.
4. Ton: ${selectedTone}
5. Metin sonuna doğru takipçilere konuyla ilgili mutlaka bir SORU SOR (Örn: "Siz bu teknoloji hakkında ne düşünüyorsunuz?", "Almayı düşünür müsünüz?").
6. Clickbait olmamalı — somut bilgi ver.
7. Metnin en altında konuyla ilgili, spesifik 10-15 adet hashtag ekle.
8. Emoji kullanımı serbesttir, konuya uygun emojiler kullan (max 5-6 emoji).
9. "Link bioda" gibi yönlendirmeler yapma, kaynağı metin içinde belirt.

ÇIKTI FORMATI (JSON):
{
  "caption": "Instagram için hazırlanan uzun açıklama metni...",
  "translatedTitle": "Haber başlığının Türkçe çevirisi (Görselde kullanılacak, maks 60 karakter)",
  "hashtags": ["#donanim", "#teknoloji", "#guncelleme"],
  "tone": "..."
}

Sadece JSON döndür, başka hiçbir şey yazma.`;

  try {
    log.debug({ title, category, hasVideo: !!videoPath }, 'Gemini Instagram caption üretiliyor');

    let contentArgs: any[] = [prompt];
    
    if (videoPath) {
      // Sadece prompt'a ekliyoruz, File API'ye daha önce yüklendiyse (tweet üretiminde) tekrar yüklemeye gerek yok ama
      // basitlik adına şimdilik tekrar yüklüyoruz. Performans için File URI'sini dışarıdan alacak şekilde de refactor edilebilir.
      log.info('Video Gemini\'ye yükleniyor (IG için)...');
      const uploadResult = await fileManager.uploadFile(videoPath, {
        mimeType: 'video/mp4',
      });
      contentArgs = [
        prompt,
        {
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: uploadResult.file.mimeType,
          },
        },
      ];
    }

    const result = await flashModel.generateContent(contentArgs);
    const responseText = result.response.text().trim();

    // JSON parse et
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini geçersiz JSON döndürdü');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      caption: string;
      translatedTitle?: string;
      hashtags?: string[];
      tone: string;
    };

    const finalCaption = sanitizeTweetText(parsed.caption);
    const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];

    log.info(
      { title, category, captionLength: finalCaption.length },
      'Instagram Caption üretildi',
    );

    return {
      caption: finalCaption,
      translatedTitle: parsed.translatedTitle || title,
      hashtags,
      tone: parsed.tone ?? selectedTone,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ err: errMsg, title }, 'Gemini Instagram caption üretimi başarısız');
    throw new Error(`AI Instagram caption üretimi başarısız: ${errMsg}`);
  }
}

export interface DigestArticleInput {
  title: string;
  category?: string;
  sourceName?: string;
  tweetText?: string;
}

/**
 * Günlük bülten (Digest) için tüm haberleri kapsayan ortak Instagram açıklaması üretir.
 */
export async function generateDigestCaption(
  articles: DigestArticleInput[],
  digestType: 'noon' | 'evening' | 'manual',
): Promise<string> {
  const bultenAd = 'Günün Raporu';

  const articlesListText = articles
    .map((a, i) => `${i + 1}. [${a.sourceName || 'Kaynak'}] ${a.title}${a.tweetText ? ` (Özet: ${a.tweetText})` : ''}`)
    .join('\n');

  const prompt = `Sen "TeknoFiltre" teknoloji yayıncılığı markasının baş editörüsün. Sloganın: "Gereksizi eliyorum, ne işe yarar onu yazıyorum."
GÖREV: Bugün Instagram Reels'ta yayınlanacak olan toplu teknoloji bülteni videosu için yüksek etkileşimli, merak uyandıran ve okunaklı bir Türkçe Instagram açıklaması (caption) hazırla.

BÜLTEN TÜRÜ: ${bultenAd}
BÜLTENDE YER ALAN HABERLER:
${articlesListText}

KURALLAR:
1. Başlangıç: Vurucu bir başlık (örn: "⚡️ TeknoFiltre ${bultenAd} | Günün 3 Önemli Gelişmesi").
2. Maddeler: Bültendeki her haberi numaralandırılmış emojiyle (1️⃣, 2️⃣, 3️⃣...) açıkla ve netleştir. İzleyiciler başlığı zaten video slaytında gördüğü için, bu açıklama metninde haberin ne anlama geldiğini, perde arkasını ve önemli teknik detayını aktaran bilgilendirici ve doyurucu 1-2 cümle yaz.
3. Etkileşim Çağrısı (CTA): Okuyuculara konuyla ilgili samimi bir soru sor (örn: "💬 Sizin günün en çok dikkatinizi çeken gelişmesi hangisi oldu? Yorumlarda buluşalım!").
4. Marka ve Takip Daveti: TeknoFiltre'yi takip etmeye davet et.
5. Hashtag: 5-8 adet en popüler teknoloji etiketi ekle (#teknofiltre #teknoloji #donanım #oyun #reels vb.).
6. "AutoSocial" veya "DonanımPost" kelimelerini ASLA kullanma; marka adı kesinlikle "TeknoFiltre"dir.
7. Uzunluk Limiti: Instagram'ın maksimum açıklama limiti 2.200 karakterdir. Tüm metin KESİNLİKLE 1.500 ile 2.050 karakter arasında olmalıdır.

ÇIKTI FORMATI:
Sadece aşağıdaki JSON formatında yanıt ver, başka açıklama ekleme:
{
  "caption": "Açıklama metni buraya..."
}`;

  try {
    const result = await flashModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.caption) {
        log.info({ digestType, articleCount: articles.length }, 'Bülten Instagram caption üretildi');
        return parsed.caption.replace(/#donanumpost\b|#donanımpost\b/gi, '#teknofiltre');
      }
    }

    return responseText.replace(/```json|```/g, '').replace(/#donanumpost\b|#donanımpost\b/gi, '#teknofiltre').trim();
  } catch (err: any) {
    log.error({ err: err.message }, 'Gemini bülten caption üretimi başarısız, şablon fallback kullanılıyor');
    const bullets = articles.map((a, i) => {
      const details = a.tweetText ? `\n\n${a.tweetText.trim()}` : '';
      return `${i + 1}️⃣ ${a.title}${details}`;
    }).join('\n\n─────────────\n\n');
    return `⚡️ TeknoFiltre ${bultenAd}\n\nGünün öne çıkan teknoloji ve donanım başlıkları:\n\n${bullets}\n\n💬 Siz bu gelişmeler hakkında ne düşünüyorsunuz? Yorumlarda buluşalım!\n\n#teknoloji #teknofiltre #donanım #reels`;
  }
}

/**
 * Günlük Instagram Reels bülteni için doğrudan şok kancayla başlayan ve her haber için
 * 1-e-1 eşleşen segmentler üreten AI Türkçe seslendirme metni üretir.
 * Sıfır selamlaşma, saf hap bilgi, her haberin eksiksiz aktarımı ve sonda CTA.
 */
function extractPunchyFallbackHook(title: string, tweetText?: string): string {
  if (tweetText) {
    // Tweet metninin ilk satırı veya ilk cümlesi zaten format gereği vurucu kancadır
    const firstSentence = tweetText.split(/\n\n|[.!?]\s+/)[0]?.trim();
    if (firstSentence && firstSentence.length >= 10 && firstSentence.length <= 110) {
      return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
    }
  }
  return title.endsWith('.') ? title : `${title}.`;
}

export async function generateReelsDigestScript(
  articles: DigestArticleInput[],
): Promise<ReelsScriptResult> {
  const articlesListText = articles
    .map((a, i) => `${i + 1}. [Haber ${i + 1}] ${a.title}${a.tweetText ? ` (Özet: ${a.tweetText})` : ''}`)
    .join('\n');

  const prompt = `Sen "TeknoFiltre" markasının Instagram Reels spikerisin.
GÖREV: Aşağıdaki ${articles.length} haber için ultra dinamik, çok kısa ve akıcı bir Türkçe Reels seslendirme metni hazırla.
VİDEO YAPISI: Videoda ${articles.length} adet slayt art arda gösterilecek. Her slayt tam olarak bir habere aittir.

HABER LİSTESİ:
${articlesListText}

ALTIN KURALLAR (VİDEO SÜRESİ KESİNLİKLE 25-35 SANİYEYİ GEÇMEMELİDİR):
1. SAF HAP BİLGİ & MİKRO ÖZET (EN KRİTİK KURAL):
   - Detayları, teknik özellikleri ve cebe etkisini videoda ANLATMA; tüm detaylar Instagram açıklamasında (caption) verilecek.
   - Her segment KESİNLİKLE tek bir vurucu cümle ve MAKSİMUM 10-14 KELİME olmalıdır (TTS okuma süresi ~6-8 saniye).
   - Uzun cümleler, teknik izahatlar ve yan detaylar KESİNLİKLE YASAKTIR.
   - Örnek: "AMD kartlara Nvidia dopingi geldi! Gayriresmi modla eldeki karta bedava devasa FPS artışı sağlandı."
2. GİRİŞTE SELAMLAŞMA KESİNLİKLE YASAKTIR:
   - "Herkese merhaba", "Selamlar", "Bugün sizlerle" gibi selamlaşma veya boş giriş kalıplarını KESİNLİKLE KULLANMA. İlk kelime doğrudan en çarpıcı habere dair şok bir kanca olmalı!
3. HER HABER İÇİN TAM 1 SEGMENT (ZORUNLU - HİÇBİR HABERİ ATLAYAMAZSIN):
   - "segments" dizisi tam olarak gelen haber sayısı kadar eleman İÇERMEK ZORUNDADIR (${articles.length} adet).
   - Her slayt ekrandayken tam olarak o haber seslendirilecektir.
4. ÇOK KISA OUTRO (MAKSİMUM 8-10 KELİME):
   - outroScript: Videoyu gereksiz uzatmadan tek cümleyle bitir:
     "Detaylar açıklamada. Teknoloji haberleri için TeknoFiltre'yi takip etmeyi unutmayın."
5. DİL VE DİKSİYON: Konuşma diliyle, net ve duraksamasız yaz.

ÇIKTI JSON FORMATI:
{
  "hookTitle": "Videonun kapağı için 3-5 kelimelik dev kanca",
  "segments": [
    {
      "articleIndex": 1,
      "headline": "1. haberin kısa başlığı",
      "script": "1. haber için maksimum 10-14 kelimelik tek cümlelik hap bilgi."
    }
  ],
  "outroScript": "Detaylar açıklamada. Teknoloji haberleri için TeknoFiltre'yi takip etmeyi unutmayın."
}

Sadece JSON döndür.`;

  try {
    const result = await flashModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini Reels script için geçersiz JSON döndürdü');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      hookTitle: string;
      segments?: Array<{ articleIndex?: number; headline?: string; script: string }>;
      outroScript?: string;
    };

    let outro = parsed.outroScript
      ? parsed.outroScript.replace(/gereksiz\s*detaysız\s*/gi, '').trim()
      : "Detaylar açıklamada. Teknoloji haberleri için TeknoFiltre'yi takip etmeyi unutmayın.";
    if (!outro.includes("TeknoFiltre'yi takip")) {
      outro += " Teknoloji haberleri için TeknoFiltre'yi takip etmeyi unutmayın.";
    }
    const rawSegments = Array.isArray(parsed.segments) ? parsed.segments : [];

    // Gelen haberlerin tamamının kapsandığını doğrula, eksik varsa tamamla
    const finalSegments: ReelsScriptSegment[] = [];
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      const matched = rawSegments.find((s) => s.articleIndex === i + 1) || rawSegments[i];
      if (matched && matched.script && matched.script.trim().length > 5) {
        finalSegments.push({
          articleIndex: i + 1,
          headline: matched.headline || art.title,
          script: matched.script.trim(),
        });
      } else {
        // Fallback segment: Haberin sadece vurucu kancasını al (videoyu asla uzatma)
        finalSegments.push({
          articleIndex: i + 1,
          headline: art.title,
          script: extractPunchyFallbackHook(art.title, art.tweetText),
        });
      }
    }

    // Tam seslendirme metni
    const spokenScript = `${finalSegments.map((s) => s.script).join(' ')} ${outro}`.trim();

    log.info(
      {
        hookTitle: parsed.hookTitle,
        segmentCount: finalSegments.length,
        spokenLength: spokenScript.length,
      },
      '🎬 Reels segmentli spiker metni başarıyla üretildi',
    );

    return {
      hookTitle: parsed.hookTitle || 'TeknoFiltre Günün Özeti',
      segments: finalSegments,
      outroScript: outro,
      spokenScript,
    };
  } catch (err: any) {
    log.error({ err: err.message }, 'Gemini Reels script üretimi başarısız, kısa fallback oluşturuluyor');
    const outro = "Detaylar açıklamada. Teknoloji haberleri için TeknoFiltre'yi takip etmeyi unutmayın.";
    const fallbackSegments: ReelsScriptSegment[] = articles.map((art, i) => ({
      articleIndex: i + 1,
      headline: art.title,
      script: extractPunchyFallbackHook(art.title, art.tweetText),
    }));

    return {
      hookTitle: 'TeknoFiltre Günün Özeti',
      segments: fallbackSegments,
      outroScript: outro,
      spokenScript: `${fallbackSegments.map((s) => s.script).join(' ')} ${outro}`,
    };
  }
}

/**
 * Tweet metnini temizle — regex ile hassas veri temizliği
 */
function sanitizeTweetText(text: string): string {
  return text
    // E-posta adresleri
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[e-posta]')
    // Telefon numaraları
    .replace(/(\+?\d[\d\s-]{8,}\d)/g, '[tel]')
    // Satır içi birden fazla boşluğu tek boşluğa indir (satır sonlarını korur)
    .replace(/[^\S\r\n]+/g, ' ')
    // 3 veya daha fazla satır sonunu çift satır sonuna (\n\n) indir
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface CarouselScriptResult {
  hook: string;
  summaryTitle: string;
  summary: string;
  commentaryTitle: string;
  commentary: string;
  questionTitle: string;
  question: string;
}

/**
 * Sakin günlerde 4 slaytlık derin analiz Instagram karoseli için dinamik başlık ve metin üretir
 */
export async function generateCarouselScript(
  title: string,
  summary: string | undefined,
  sourceName: string,
  category: ArticleCategory,
): Promise<CarouselScriptResult> {
  const prompt = `Sen "TeknoFiltre" markasının teknoloji editörüsün.
Aşağıdaki haber için Instagram'da 4 slaytlık bir Carousel (kaydırmalı kart) paketi hazırlayacaksın.

HABER BAŞLIĞI: "${title}"
KAYNAK: "${sourceName}" | KATEGORİ: "${category}"
ÖZET / DETAY: "${summary || title}"

TASARIM VE METİN KURALLARI:
1. ŞABLON BAŞLIK KESİNLİKLE YASAKTIR: "Olay Ne?", "Gelişme", "Sana Etkisi Ne?", "Değer Katma" gibi bayat ve şablon başlıklar KULLANILMAYACAK.
   - 2. Slayt Başlığı (summaryTitle): Haberin özüne dair 2-4 kelimelik çarpıcı, dinamik bir başlık olmalı (Örn: "40 TFLOPS Güç Geliyor", "Zen 5 Tahtı Devraldı", "M4 Max Sahneye Çıktı").
   - 3. Slayt Başlığı (commentaryTitle): Tüketiciye/cebe etkisine dair 2-4 kelimelik dinamik bir başlık olmalı (Örn: "Fiyat 50 Bini Aşabilir", "Yeni PSU Gerekecek", "Oyun İçin Fazla Lüks").
   - 4. Slayt Başlığı (questionTitle): Soruya özel kısa başlık (Örn: "Bu Güce Değer mi?", "Sence Alınır mı?", "Yükseltmeye Gerek Var mı?").
2. SLAYT 1 (Kapak Kancası - hook): 3-5 kelimelik dev merak kancası (Örn: "PS5'ten 3 Kat Güçlü?").
3. SLAYT 2 (Haberin Özü - summary): 2-3 cümle, teknik veri ve net sayılar içeren akıcı özet.
4. SLAYT 3 (Cebe/Kullanıcıya Etkisi - commentary): 1-2 cümle, kullanıcının cebine, sistemine veya oyununa doğrudan etkisi.
5. SLAYT 4 (Soru - question): Okuyucuyu yorum yazmaya teşvik eden vurucu 1 soru.

ÇIKTI JSON FORMATI:
{
  "hook": "Kapak için 3-5 kelimelik kanca",
  "summaryTitle": "2-4 kelimelik dinamik başlık",
  "summary": "Haberin net 2-3 cümlelik özeti",
  "commentaryTitle": "2-4 kelimelik dinamik etki başlığı",
  "commentary": "Kullanıcıya/cebe etkisi yorumu",
  "questionTitle": "2-3 kelimelik soru başlığı",
  "question": "Yorum yazdıran soru cümlesi"
}

Sadece JSON döndür.`;

  try {
    const result = await flashModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini Carousel için geçersiz JSON döndürdü');
    }

    const parsed = JSON.parse(jsonMatch[0]) as CarouselScriptResult;
    log.info({ hook: parsed.hook, s2Title: parsed.summaryTitle, s3Title: parsed.commentaryTitle }, '📑 Carousel metinleri üretildi');
    return parsed;
  } catch (err: any) {
    log.error({ err: err.message }, 'Carousel Gemini üretimi başarısız, fallback oluşturuluyor');
    return {
      hook: title.substring(0, 40),
      summaryTitle: 'İşin Özü',
      summary: summary || title,
      commentaryTitle: 'Cebe Yansıması',
      commentary: 'Bu donanım hamlesi pazardaki fiyat dengelerini doğrudan değiştirebilir.',
      questionTitle: 'Sence Değer mi?',
      question: 'Siz bu gelişme hakkında ne düşünüyorsunuz? Yorumlarda buluşalım.',
    };
  }
}

