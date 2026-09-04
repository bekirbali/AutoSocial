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
 * Kategori bazlı prompt template'leri
 * Her kategori için özelleştirilmiş açılış cümlesi ve ton
 */
const CATEGORY_PROMPTS: Record<ArticleCategory, { opening: string; tones: string[] }> = {
  cpu:         { opening: 'İşlemci dünyasında dikkat çekici gelişme:', tones: ['teknik ve bilgilendirici', 'analitik', 'derinlemesine'] },
  gpu:         { opening: 'Ekran kartı haberlerinde son dakika:', tones: ['heyecanlı ve teknik', 'enerjik', 'rekabetçi'] },
  ram:         { opening: 'Bellek teknolojilerinde yeni gelişme:', tones: ['teknik ve net', 'kısa ve öz', 'bilgilendirici'] },
  storage:     { opening: 'Depolama dünyasında önemli haber:', tones: ['bilgilendirici', 'hızlı ve net', 'kıyaslamalı'] },
  motherboard: { opening: 'Anakart dünyasında dikkat çeken gelişme:', tones: ['teknik ve detaylı', 'geniş açılı', 'merak uyandırıcı'] },
  cooling:     { opening: 'Soğutma teknolojilerinde yenilik:', tones: ['meraklı ve bilgilendirici', 'buz gibi net', 'dikkat çekici'] },
  peripherals: { opening: 'PC çevre birimlerinde öne çıkan haber:', tones: ['dinamik ve çekici', 'oyuncu odaklı', 'akıcı'] },
  psu:         { opening: 'Güç kaynağı dünyasında yeni gelişme:', tones: ['bilgilendirici ve güvenilir', 'net ve sağlam', 'ciddi'] },
  case:        { opening: 'PC kasa dünyasında ilgi çekici haber:', tones: ['dengeli', 'estetik odaklı', 'pratik'] },
  gaming:      { opening: 'Oyun dünyasında son dakika:', tones: ['enerjik ve dinamik', 'heyecanlı', 'oyuncu jargonuyla esprili'] },
  deals:       { opening: '🔥 FIRSAT ALARMI:', tones: ['acil ve pratik', 'hemen al tarzı', 'dikkat çekici'] },
  software:    { opening: 'Sürücü ve yazılım güncellemelerinde önemli haber:', tones: ['teknik ve net', 'kısa ve uyarıcı', 'rehberleyici'] },
  general:     { opening: 'Donanım dünyasında öne çıkan haber:', tones: ['dengeli ve bilgilendirici', 'samimi', 'profesyonel'] },
};

/**
 * Gemini 1.5 Flash ile Türkçe tweet üret
 *
 * @param title - Orijinal haber başlığı (EN veya TR)
 * @param summary - Haber özeti (varsa)
 * @param sourceName - Kaynak adı (tweet'e eklenir)
 * @param category - Haber kategorisi (prompt template seçimi için)
 */
export async function generateTweet(
  title: string,
  summary: string | undefined,
  sourceName: string,
  category: ArticleCategory,
  videoPath?: string,
): Promise<TweetGenerationResult> {
  const categoryConfig = CATEGORY_PROMPTS[category];
  const sourceInfo = summary ? `\n\nÖzet: ${summary.substring(0, 400)}` : '';
  
  const selectedTone = categoryConfig.tones[Math.floor(Math.random() * categoryConfig.tones.length)];
  const isLongContent = summary && summary.length > 250;

  const prompt = `Sen bir PC donanım ve teknoloji haber hesabının sosyal medya editörüsün.
Aşağıdaki haber için X (Twitter) için Türkçe bir tweet ${isLongContent ? '(veya haber detaylıysa 2-3 tweetlik bir zincir/thread)' : ''} yaz.

HABER BAŞLIĞI: ${title}
KAYNAK: ${sourceName}${sourceInfo}

KURALLAR:
1. Tweet Türkçe olmalı (başlık İngilizce bile olsa Türkçe'ye çevir ve özetle)
2. Ana mesaj maksimum 240 karakter olmalı
3. Doğrudan konuya gir. "X dünyasında son dakika:", "Y konusunda gelişme:" gibi robotik/yapay giriş kalıplarını KESİNLİKLE KULLANMA. İnsansı ve direkt bir giriş yap.
4. Ton: ${selectedTone}
5. HİÇBİR ŞEKİLDE HASHTAG KULLANMA (# sembolü içermesin, profesyonel dursun)
6. Clickbait olmamalı — somut bilgi ver
7. Okuyucuyu merak ettiren ama yanıltıcı olmayan bir anlatım kullan
8. Emoji: kategori "${category}" için ${category === 'deals' ? '1-2 emoji (🔥💰)' : '0-1 emoji'}
${isLongContent ? '9. Haber çok detaylıysa metni bölerek "isThread": true yap ve "threadTweets" dizisine diğer tweetleri ekle. Aksi halde tek tweet dön.' : ''}

ÇIKTI FORMATI (JSON):
{
  "tweetText": "İlk tweet veya tek tweet...",
  "translatedTitle": "Haber başlığının Türkçe çevirisi (Görselde kullanılacak, maks 60 karakter)",
  "tone": "...",
  "isThread": ${isLongContent ? 'true/false' : 'false'},
  "threadTweets": ${isLongContent ? '["İkinci tweet (varsa)...", "Üçüncü tweet (varsa)..."]' : '[]'}
}

Sadece JSON döndür, başka hiçbir şey yazma.`;

  try {
    log.debug({ title, category, hasVideo: !!videoPath }, 'Gemini tweet üretiliyor');

    let contentArgs: any[] = [prompt];
    
    if (videoPath) {
      log.info('Video Gemini\'ye yükleniyor...');
      const uploadResult = await fileManager.uploadFile(videoPath, {
        mimeType: 'video/mp4',
        displayName: 'AutoSocial Video',
      });
      
      // Wait for ACTIVE state if needed (usually fast for short videos, but good practice)
      // For simplicity, we just pass it immediately. Flash 3.5 can handle it.
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
      isThread?: boolean;
      threadTweets?: string[];
    };

    // Güvenlik kontrolleri
    const tweetText = sanitizeTweetText(parsed.tweetText);
    const hashtags: string[] = []; // Kullanıcı isteği üzerine hashtag'ler tamamen kaldırıldı
    
    const threadTweets = parsed.isThread && parsed.threadTweets
      ? parsed.threadTweets.map(sanitizeTweetText).filter(t => t.length > 0)
      : undefined;

    // Karakter uzunluğu kontrolü
    if (tweetText.length > 280) {
      log.warn(
        { length: tweetText.length, title },
        'Tweet metni çok uzun, kırpılıyor',
      );
    }

    const finalTweet = tweetText.substring(0, 280);

    log.info(
      { title, category, tweetLength: finalTweet.length, isThread: parsed.isThread },
      'Tweet üretildi',
    );

    return {
      tweetText: finalTweet,
      translatedTitle: parsed.translatedTitle || title,
      hashtags,
      tone: parsed.tone ?? selectedTone,
      isThread: !!parsed.isThread,
      threadTweets,
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
  const categoryConfig = CATEGORY_PROMPTS[category];
  const sourceInfo = summary ? `\n\nÖzet: ${summary.substring(0, 400)}` : '';
  
  const selectedTone = categoryConfig.tones[Math.floor(Math.random() * categoryConfig.tones.length)];

  const prompt = `Sen bir PC donanım ve teknoloji haber hesabının sosyal medya editörüsün.
Aşağıdaki haber için Instagram'a uygun, takipçilerle etkileşim kuran Türkçe bir açıklama (caption) yaz.

HABER BAŞLIĞI: ${title}
KAYNAK: ${sourceName}${sourceInfo}

KURALLAR:
1. Metin Türkçe olmalı (başlık İngilizce bile olsa Türkçe'ye çevir ve özetle).
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
