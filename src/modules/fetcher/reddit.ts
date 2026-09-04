import axios from 'axios';
import { createLogger } from '../../lib/logger.js';
import type { FetchedItem } from './rss.js';

const log = createLogger('fetcher:reddit');

/**
 * Belirtilen Subreddit'ten (örn: PublicFreakout) "hot" veya "rising" olan son postları çeker.
 * Sadece video içeren postları filtreler.
 */
export async function fetchRedditVideos(subreddit: string, limit: number = 10): Promise<FetchedItem[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
  log.info({ subreddit, url }, 'Reddit API\'den veri çekiliyor...');

  try {
    const response = await axios.get(url, {
      headers: {
        // Reddit bot tespitini atlatmak için gerçekçi bir tarayıcı User-Agent kullanıyoruz
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const children = response.data?.data?.children || [];
    const items: FetchedItem[] = [];

    for (const child of children) {
      const post = child.data;
      
      // Sadece video içeren postları filtrele (v.redd.it veya medya içerenler)
      const isVideo = post.is_video || (post.secure_media && post.secure_media.reddit_video);
      
      if (!isVideo) continue;

      // Video linkini çıkar (Reddit'in kendi player linki veya doğrudan URL)
      let videoUrl = post.url;
      if (post.is_video && post.media?.reddit_video?.fallback_url) {
        // Genellikle ham fallback_url iyidir, ancak yt-dlp standart url'yi de alabilir.
        // yt-dlp'nin post URL'sini çözmesi daha sağlıklıdır. (Yani reddit.com/r/.../comments/...)
        videoUrl = `https://www.reddit.com${post.permalink}`;
      } else {
         videoUrl = `https://www.reddit.com${post.permalink}`;
      }

      items.push({
        sourceId: 'reddit', // Bunu config'den de bağlayabiliriz
        sourceName: `r/${subreddit}`,
        lang: 'en', // veya dinamik olarak ayarlayabilirsiniz
        url: videoUrl,
        title: post.title,
        summary: post.selftext || '',
        publishedAt: new Date(post.created_utc * 1000),
        imageUrl: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined,
        videoUrl: videoUrl,
        mediaType: 'video', // Schema'ya eklediğimiz yeni alan
      });
    }

    log.info({ count: items.length }, `Reddit r/${subreddit} üzerinden video postlar çekildi.`);
    return items;
  } catch (error: any) {
    log.error({ err: error.message }, `Reddit r/${subreddit} çekilirken hata oluştu.`);
    return [];
  }
}
