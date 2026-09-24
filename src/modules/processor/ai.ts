import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import type { ArticleCategory } from '../../config/keywords.js';

const log = createLogger('processor:ai');

// Gemini istemcisi — modüle yüklendiğinde bir kez başlatılır
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(env.GEMINI_API_KEY);
const flashModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

export interface TweetGenerationResult {
  tweetText: string;
  translatedTitle: string;
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
  ai:          { angle: 'Geliştiricilere hız katan modeller, açık kaynak LLM\'ler ve donanım gereksinimleri', hookHint: 'yapay zekada ezber bozan veya işleri kolaylaştıran hamle' },
  mobile:      { angle: 'Kamera yetenekleri, işlemci (Apple Silicon/Snapdragon) performansı, pil/şarj ömrü, yapay zeka özellikleri ve kullanıcı deneyimi', hookHint: 'akıllı telefon pazarındaki rekabet, kamera devrimi veya günlük kullanımı değiştiren yeni özellikler' },
  general:     { angle: 'Teknoloji ekosistemi, donanım endüstrisi ve geleceğin standartları', hookHint: 'sektörün geleceğini şekillendiren kritik gelişme' },
};

/**
 * Gemini ile Türkçe yüksek etkileşimli küratör tweeti üret
 *
 * @param title - Orijinal haber başlığı (EN veya TR)
 * @param summary - Haber özeti (varsa)
 * @param sourceName - Kaynak adı
 * @param category - Haber kategorisi
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

  const prompt = `Sen X'te (Twitter) yüz binlerce teknoloji meraklısı, yazılımcı ve donanım tutkunu tarafından takip edilen, kuru ajans haberciliği YAPMAYAN, samimi ve uzman bir teknoloji küratörüsün.

GÖREV: Aşağıdaki içeriği analiz et ve X'te yüksek etkileşim, retweet ve yer imi (bookmark) alacak, değer odaklı ve hap bilgi içeren tek ve vurucu bir Türkçe tweet hazırla.

HABER BAŞLIĞI: ${title}
KAYNAK: ${sourceName}${sourceInfo}
KATEGORİ ODAĞI: ${guide.angle} (${guide.hookHint})

KRİTİK İÇERİK KURALLARI:
1. KURUMSAL VE AJANS DİLİNİ TERK ET: "X şirketi Y ürününü duyurdu", "...açıklandı", "...bildirildi" gibi monoton ajans kalıplarını KESİNLİKLE KULLANMA. Doğrudan konunun özüne giren, dinamik ve insansı bir dil kullan.
2. GÜÇLÜ KANCA (HOOK): İlk satır akışta kaydırmayı durduran (scroll-stopper) nitelikte olsun. Okuyucunun "Burada ne oluyor?" demesini sağla.
3. SOMUT DEĞER VE HAP BİLGİ: Varsa sayısal verileri (FPS, watt, fiyat, frekans, çekirdek, mimari detay) doğrudan paylaş. Okuyucu 5 saniyede net bir bilgi alsın.
4. ETKİLEŞİM / TARTIŞMA ÇAĞRISI: Tweetin sonuna okuyucuyu yorum yapmaya sevk edecek zekice, kısa bir soru veya çarpıcı bir kapanış ekle (Örn: "Sizce bu adım pazar dengelerini değiştirir mi?", "Bu fiyata tercih eder miydiniz?").
5. KARAKTER SINIRI: Tweet maksimum 240-270 karakter olmalıdır. Tüm kurgu, kanca ve hap bilgi bu tek tweette yer almalıdır.
6. KESİNLİKLE HASHTAG KULLANMA: Metin içinde hiçbir '#' sembolü yer almasın.
7. YERİNDE EMOJİ: En fazla 1-2 adet (ör. ⚡, 🚀, 💡, 🔥), göz yormayan yerinde emoji kullan.
8. KESİNLİKLE YASAKLI YÖNLENDİRME KALIPLARI: "Detaylar zincirde", "detaylar aşağıda", "devamı flood'da", "zincirde", "thread", "flood" gibi devam/yönlendirme ifadelerini KESİNLİKLE KULLANMA. Bu tek ve bağımsız bir tweettir, devamı yoktur.

ÇIKTI FORMATI (YALNIZCA GEÇERLİ JSON):
{
  "tweetText": "Vurucu tek tweet (kanca + hap bilgi + tartışma sorusu)",
  "translatedTitle": "Görsel kart için kısa, vurucu Türkçe başlık (maks 55 karakter)",
  "tone": "küratör"
}

Sadece JSON döndür, markdown formatı dışında hiçbir şey yazma.`;

  try {
    log.debug({ title, category, hasVideo: !!videoPath }, 'Gemini tweet üretiliyor');

    let contentArgs: any[] = [prompt];
    
    if (videoPath) {
      log.info('Video Gemini\'ye yükleniyor...');
      const uploadResult = await fileManager.uploadFile(videoPath, {
        mimeType: 'video/mp4',
        displayName: 'AutoSocial Video',
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
      translatedTitle?: string;
      tone: string;
    };

    // Güvenlik kontrolleri
    let tweetText = sanitizeTweetText(parsed.tweetText);
    // Yapay zeka kaçaklarını önlemek için yönlendirme kalıplarını temizle
    tweetText = tweetText
      .replace(/\s*detaylar\s+(zincirde|aşağıda|flood'da|yorumda|yorumlarda)[.!?\s👇]*/gi, '')
      .replace(/\s*devamı\s+(zincirde|aşağıda|flood'da|yorumda|yorumlarda)[.!?\s👇]*/gi, '')
      .trim();

    const hashtags: string[] = []; // Kullanıcı isteği üzerine hashtag'ler tamamen kaldırıldı

    // Karakter uzunluğu kontrolü
    if (tweetText.length > 280) {
      log.warn(
        { length: tweetText.length, title },
        'Tweet metni çok uzun, kırpılıyor',
      );
    }

    const finalTweet = tweetText.substring(0, 280);

    log.info(
      { title, category, tweetLength: finalTweet.length },
      'Tweet üretildi',
    );

    return {
      tweetText: finalTweet,
      translatedTitle: parsed.translatedTitle || title,
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
  const bultenAd =
    digestType === 'noon'
      ? 'Öğle Bülteni'
      : digestType === 'evening'
      ? 'Akşam Bülteni'
      : 'Günün Teknoloji Özeti';

  const articlesListText = articles
    .map((a, i) => `${i + 1}. [${a.sourceName || 'Kaynak'}] ${a.title}${a.tweetText ? ` (Özet: ${a.tweetText})` : ''}`)
    .join('\n');

  const prompt = `Sen "DonanımPost" teknoloji yayıncılığı markasının baş editörüsün.
GÖREV: Bugün Instagram Reels'ta yayınlanacak olan toplu teknoloji bülteni videosu için yüksek etkileşimli, merak uyandıran ve okunaklı bir Türkçe Instagram açıklaması (caption) hazırla.

BÜLTEN TÜRÜ: ${bultenAd}
BÜLTENDE YER ALAN HABERLER:
${articlesListText}

KURALLAR:
1. Başlangıç: Vurucu bir başlık (örn: "⚡️ DonanımPost ${bultenAd}" veya "DonanımPost ile Günün Teknoloji Özeti").
2. Maddeler: Bültendeki her haberi numaralandırılmış emojiyle (1️⃣, 2️⃣, 3️⃣...) açıkla ve netleştir. İzleyiciler başlığı zaten video slaytında gördüğü için, bu açıklama metninde haberin ne anlama geldiğini, perde arkasını ve önemli teknik detayını aktaran bilgilendirici ve doyurucu 1-2 cümle yaz.
3. Etkileşim Çağrısı (CTA): Okuyuculara konuyla ilgili samimi bir soru sor (örn: "💬 Sizin günün en çok dikkatinizi çeken gelişmesi hangisi oldu? Yorumlarda buluşalım!").
4. Marka ve Takip Daveti: DonanımPost'u takip etmeye davet et.
5. Hashtag: 5-8 adet en popüler teknoloji etiketi ekle (#donanımpost #donanım #teknoloji #ekrankartı #oyun #reels vb. Marka etiketi kesinlikle #donanımpost olmalıdır, "u" harfiyle #donanumpost yazma).
6. "AutoSocial" kelimesini ASLA kullanma; marka adı kesinlikle "DonanımPost"tur.
7. Uzunluk Limiti: Instagram'ın maksimum açıklama limiti 2.200 karakterdir. Tüm metin (başlık, 7 haberin detayları, CTA ve etiketler dahil) KESİNLİKLE 1.700 ile 2.050 karakter arasında olmalıdır, 2.100 karakteri ASLA geçmemelidir.

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
        return parsed.caption.replace(/#donanumpost\b/gi, '#donanımpost');
      }
    }

    // JSON parse edilemezse doğrudan metni temizle ve döndür
    return responseText.replace(/```json|```/g, '').replace(/#donanumpost\b/gi, '#donanımpost').trim();
  } catch (err: any) {
    log.error({ err: err.message }, 'Gemini bülten caption üretimi başarısız, şablon fallback kullanılıyor');
    // Fallback caption
    const bullets = articles.map((a, i) => `${i + 1}️⃣ ${a.title}`).join('\n');
    return `⚡️ DonanımPost ${bultenAd}\n\n${bullets}\n\n💬 Günün en çok dikkatinizi çeken haberi hangisi oldu? Yorumlarda konuşalım!\n\n#donanım #teknoloji #donanımpost #reels`;
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
    // Aşırı boşluklar
    .replace(/\s+/g, ' ')
    .trim();
}
