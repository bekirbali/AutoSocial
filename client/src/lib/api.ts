import type {
  OverviewResponse,
  ArticleItem,
  DigestCandidate,
  DigestResult,
  QueueJobItem,
  SourceItem,
} from '../types/api';

const API_BASE = '/api/admin';

export async function fetchOverview(): Promise<OverviewResponse> {
  const res = await fetch(`${API_BASE}/overview`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Overview yüklenemedi');
  return json.data;
}

export async function fetchArticles(status?: string): Promise<ArticleItem[]> {
  const url = status && status !== 'all' ? `${API_BASE}/articles?status=${status}` : `${API_BASE}/articles`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Makaleler yüklenemedi');
  return json.data;
}

export async function postArticleAction(
  id: string,
  action: 'publish_now' | 'schedule' | 'reject' | 'update',
  payload?: { tweetText?: string; translatedTitle?: string; reason?: string },
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/articles/${id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Aksiyon uygulanamadı');
  return json;
}

export async function reRenderCard(
  id: string,
  payload: { title?: string; imageUrl?: string },
): Promise<string> {
  const res = await fetch(`${API_BASE}/articles/${id}/render-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Kart render hatası');
  return json.cardImageUrl;
}

export async function fetchDigestCandidates(): Promise<DigestCandidate[]> {
  const res = await fetch(`${API_BASE}/digest/candidates`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Adaylar yüklenemedi');
  return json.data;
}

export async function composeDigest(
  articleIds: string[],
  digestType: 'noon' | 'evening' | 'manual' = 'manual',
): Promise<DigestResult> {
  const res = await fetch(`${API_BASE}/digest/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleIds, digestType }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Bülten derlenemedi');
  return json.data;
}

export async function publishDigestToInstagram(digestId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/digest/${digestId}/publish`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Instagram yayını başarısız');
}

export async function fetchQueues(): Promise<{
  fetch: QueueJobItem[];
  publish: QueueJobItem[];
  analytics: QueueJobItem[];
}> {
  const res = await fetch(`${API_BASE}/queues`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Kuyruklar yüklenemedi');
  return json.data;
}

export async function retryQueueJob(queueName: string, jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/queues/retry/${queueName}/${jobId}`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Yeniden deneme başarısız');
}

export async function triggerManualFetch(): Promise<void> {
  const res = await fetch(`${API_BASE}/queues/trigger-fetch`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Fetch başlatılamadı');
}

export async function clearFailedJobs(): Promise<void> {
  const res = await fetch(`${API_BASE}/queues/clear-failed`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Hatalı işler temizlenemedi');
}


export async function fetchSettings(): Promise<{
  sources: SourceItem[];
  categories: string[];
  keywords: Record<string, string[]>;
  env: any;
}> {
  const res = await fetch(`${API_BASE}/settings`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Ayarlar yüklenemedi');
  return json.data;
}
