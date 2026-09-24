export interface KpiData {
  todayPublished: number;
  maxTweets: number;
  quotaRemaining: number;
  pendingCount: number;
  preApprovedCount?: number;
  scheduledCount: number;
  publishedTodayCount: number;
}

export interface QueueCount {
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
  paused?: number;
}

export interface SystemData {
  mode: string;
  enableInstagram: boolean;
  publicUrl: string;
  serverTime: string;
  xManualMode?: boolean;

  stats?: {
    articlesFetched: number;
    articlesProcessed: number;
    articlesPublished: number;
    articlesRejected: number;
  } | null;
}

export interface OverviewResponse {
  kpi: KpiData;
  queues: {
    fetch: QueueCount;
    publish: QueueCount;
    analytics: QueueCount;
  };
  system: SystemData;
}

export interface ArticleItem {
  id: string;
  score: string;
  tweetText: string;
  translatedTitle: string;
  category: string;
  status: 'pending' | 'pre_approved' | 'approved' | 'published' | 'rejected' | 'failed';
  imagePath: string | null;
  videoPath: string | null;
  cardImageUrl: string | null;
  instagramCaption: string | null;
  platformTargets: string[] | null;
  includedInDigest: boolean;
  createdAt: string;
  updatedAt: string;
  rawTitle: string;
  rawUrl: string;
  rawImageUrl: string | null;
  rawPublishedAt: string | null;
  sourceName: string | null;
  tweetId: string | null;
  tweetUrl: string | null;
  tweetPublishedAt: string | null;
}

export interface DigestCandidate {
  id: string;
  tweetText: string;
  translatedTitle: string;
  displayTitle: string;
  category: string;
  score: string;
  status: string;
  sourceName: string | null;
  rawImageUrl: string | null;
  tweetPublishedAt: string | null;
  tweetUrl: string | null;
}

export interface DigestResult {
  digestId: string;
  videoUrl: string;
  caption: string;
  status: string;
  articleCount: number;
  slides: string[];
}

export interface QueueJobItem {
  id: string;
  name: string;
  data: any;
  timestamp: number;
  delay?: number;
  failedReason?: string;
}

export interface SourceItem {
  id: string;
  name: string;
  url: string;
  rssUrl: string;
  lang: string;
  reliability: number;
  categories: string[];
  isActive: boolean;
}
