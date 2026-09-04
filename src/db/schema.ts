import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  decimal,
  bigint,
  jsonb,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── HABER KAYNAKLARI ────────────────────────────────────────────────────────

export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    url: text('url').notNull(),
    rssUrl: text('rss_url'),
    scrapeUrl: text('scrape_url'),
    lang: text('lang').default('tr').notNull(),
    reliability: integer('reliability').default(3).notNull(),
    categories: text('categories').array(),
    isActive: boolean('is_active').default(true).notNull(),
    websubHub: text('websub_hub'),
    consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (t) => [uniqueIndex('sources_url_idx').on(t.url)],
);

// ─── HAM HABERLER (işlenmemiş) ───────────────────────────────────────────────

export const rawArticles = pgTable(
  'raw_articles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sourceId: uuid('source_id').references(() => sources.id),
    url: text('url').notNull(),
    urlHash: text('url_hash').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    fullText: text('full_text'),
    imageUrl: text('image_url'),
    videoUrl: text('video_url'),
    mediaType: text('media_type').default('image').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    lang: text('lang').default('en').notNull(),
    categories: text('categories').array(),
  },
  (t) => [
    uniqueIndex('raw_articles_url_idx').on(t.url),
    uniqueIndex('raw_articles_url_hash_idx').on(t.urlHash),
    index('raw_articles_source_id_idx').on(t.sourceId),
    index('raw_articles_published_at_idx').on(t.publishedAt),
  ],
);

// ─── İŞLENMİŞ HABERLER (AI çıktısıyla) ─────────────────────────────────────

export const processedArticles = pgTable(
  'processed_articles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    rawArticleId: uuid('raw_article_id')
      .references(() => rawArticles.id)
      .unique(),
    score: decimal('score', { precision: 5, scale: 2 }),
    tweetText: text('tweet_text').notNull(),
    hashtags: text('hashtags').array(),
    threadTweets: jsonb('thread_tweets'),
    imagePath: text('image_path'),
    videoPath: text('video_path'),
    imageSource: text('image_source'),
    tone: text('tone'),
    category: text('category'),
    status: text('status').default('pending').notNull(),
    // 'pending' | 'approved' | 'rejected' | 'queued' | 'published' | 'failed'
    platformTargets: text('platform_targets').array(), // örn: ['x', 'instagram']
    instagramCaption: text('instagram_caption'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (t) => [
    index('processed_articles_status_idx').on(t.status),
    index('processed_articles_created_at_idx').on(t.createdAt),
  ],
);

// ─── YAYINLANAN TWEETLER ────────────────────────────────────────────────────

export const publishedTweets = pgTable(
  'published_tweets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    processedId: uuid('processed_id').references(() => processedArticles.id),
    tweetId: text('tweet_id').notNull(),
    tweetUrl: text('tweet_url').notNull(),
    replyTweetId: text('reply_tweet_id'),
    publishedAt: timestamp('published_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    impressions: integer('impressions').default(0).notNull(),
    likes: integer('likes').default(0).notNull(),
    retweets: integer('retweets').default(0).notNull(),
    replies: integer('replies').default(0).notNull(),
    bookmarks: integer('bookmarks').default(0).notNull(),
    profileVisits: integer('profile_visits').default(0).notNull(),
    lastAnalyticsAt: timestamp('last_analytics_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('published_tweets_tweet_id_idx').on(t.tweetId),
    index('published_tweets_published_at_idx').on(t.publishedAt),
  ],
);

// ─── YAYINLANAN INSTAGRAM GÖNDERİLERİ ────────────────────────────────────────

export const publishedInstagramPosts = pgTable(
  'published_instagram_posts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    processedId: uuid('processed_id').references(() => processedArticles.id),
    igMediaId: text('ig_media_id').notNull(),
    igPostUrl: text('ig_post_url').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
    likes: integer('likes').default(0).notNull(),
    comments: integer('comments').default(0).notNull(),
    shares: integer('shares').default(0).notNull(),
    saves: integer('saves').default(0).notNull(),
    impressions: integer('impressions').default(0).notNull(),
    reach: integer('reach').default(0).notNull(),
    lastAnalyticsAt: timestamp('last_analytics_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('published_ig_media_id_idx').on(t.igMediaId),
    index('published_ig_published_at_idx').on(t.publishedAt),
  ],
);

// ─── SİSTEM LOGLARI ──────────────────────────────────────────────────────────

export const systemLogs = pgTable(
  'system_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    level: text('level').notNull(),
    module: text('module').notNull(),
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`NOW()`)
      .notNull(),
  },
  (t) => [
    index('system_logs_level_idx').on(t.level),
    index('system_logs_module_idx').on(t.module),
    index('system_logs_created_at_idx').on(t.createdAt),
  ],
);

// ─── GÜNLÜK İSTATİSTİKLER ────────────────────────────────────────────────────

export const dailyStats = pgTable(
  'daily_stats',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    date: date('date').notNull(),
    articlesFetched: integer('articles_fetched').default(0).notNull(),
    articlesProcessed: integer('articles_processed').default(0).notNull(),
    articlesPublished: integer('articles_published').default(0).notNull(),
    articlesRejected: integer('articles_rejected').default(0).notNull(),
    totalImpressions: bigint('total_impressions', { mode: 'number' }).default(0).notNull(),
    totalLikes: integer('total_likes').default(0).notNull(),
    totalRetweets: integer('total_retweets').default(0).notNull(),
    apiCallsUsed: integer('api_calls_used').default(0).notNull(),
  },
  (t) => [uniqueIndex('daily_stats_date_idx').on(t.date)],
);

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────────
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type RawArticle = typeof rawArticles.$inferSelect;
export type NewRawArticle = typeof rawArticles.$inferInsert;

export type ProcessedArticle = typeof processedArticles.$inferSelect;
export type NewProcessedArticle = typeof processedArticles.$inferInsert;

export type PublishedTweet = typeof publishedTweets.$inferSelect;
export type NewPublishedTweet = typeof publishedTweets.$inferInsert;

export type PublishedInstagramPost = typeof publishedInstagramPosts.$inferSelect;
export type NewPublishedInstagramPost = typeof publishedInstagramPosts.$inferInsert;

export type SystemLog = typeof systemLogs.$inferSelect;
export type NewSystemLog = typeof systemLogs.$inferInsert;

export type DailyStat = typeof dailyStats.$inferSelect;
export type NewDailyStat = typeof dailyStats.$inferInsert;
