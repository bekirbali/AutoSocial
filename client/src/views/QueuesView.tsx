import React, { useState, useEffect } from 'react';
import {
  Layers,
  Zap,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Activity,
  Filter,
  Trash2,
} from 'lucide-react';

import type { QueueJobItem } from '../types/api';
import { fetchQueues, retryQueueJob, triggerManualFetch, clearFailedJobs } from '../lib/api';


export const QueuesView: React.FC = () => {
  const [jobs, setJobs] = useState<{
    fetch: QueueJobItem[];
    publish: QueueJobItem[];
    analytics: QueueJobItem[];
  }>({ fetch: [], publish: [], analytics: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'publish' | 'fetch' | 'failed'>('all');
  const [isTriggering, setIsTriggering] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 10000); // 10 saniyede bir otomatik yenile
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const data = await fetchQueues();
      setJobs(data);
    } catch (err: any) {
      console.error('Kuyruklar yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualFetch = async () => {
    setIsTriggering(true);
    setStatusMessage(null);
    try {
      await triggerManualFetch();
      setStatusMessage({
        type: 'success',
        text: 'RSS taraması arka planda tetiklendi. Yeni haberler akışa düşüyor.',
      });
      setTimeout(loadJobs, 2000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Fetch başlatılamadı.',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const [isClearing, setIsClearing] = useState(false);

  const handleRetry = async (queueName: string, jobId: string) => {
    setRetryingJobId(jobId);
    setStatusMessage(null);
    try {
      await retryQueueJob(queueName, jobId);
      setStatusMessage({
        type: 'success',
        text: `İş (${jobId}) başarıyla yeniden kuyruğa eklendi.`,
      });
      loadJobs();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Yeniden deneme başarısız.',
      });
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleClearFailed = async () => {
    if (!window.confirm('Tüm hatalı kuyruk işlerini temizlemek istediğinize emin misiniz?')) return;
    setIsClearing(true);
    setStatusMessage(null);
    try {
      await clearFailedJobs();
      setStatusMessage({
        type: 'success',
        text: 'Tüm hatalı kuyruk işleri başarıyla temizlendi.',
      });
      loadJobs();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Hatalı işler temizlenemedi.',
      });
    } finally {
      setIsClearing(false);
    }
  };


  // Birleştirilmiş ve filtrelenmiş iş listesi
  const allJobs: { queue: string; job: QueueJobItem }[] = [
    ...jobs.publish.map((j) => ({ queue: 'publish', job: j })),
    ...jobs.fetch.map((j) => ({ queue: 'fetch', job: j })),
    ...jobs.analytics.map((j) => ({ queue: 'analytics', job: j })),
  ];

  const failedJobs = allJobs.filter((item) => !!item.job.failedReason);

  const filteredJobs = allJobs.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'publish') return item.queue === 'publish';
    if (activeTab === 'fetch') return item.queue === 'fetch';
    if (activeTab === 'failed') return !!item.job.failedReason;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ─── Header & Action Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold text-white font-['Outfit'] m-0 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            BullMQ Kuyruk & İşlem Kokpiti
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gecikmeli paylaşımlar, bot koruma sapmaları (jitter) ve hata kayıtları.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadJobs}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900/90 border border-slate-800 transition"
            title="Kuyrukları Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleManualFetch}
            disabled={isTriggering}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
            <span>{isTriggering ? 'Taranıyor...' : 'Manuel RSS Tara'}</span>
          </button>

          {failedJobs.length > 0 && (
            <button
              onClick={handleClearFailed}
              disabled={isClearing}
              className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-xl shadow-lg shadow-rose-500/10 transition cursor-pointer disabled:opacity-50"
              title="Kuyruktaki tüm hatalı işleri temizle"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isClearing ? 'animate-spin' : ''}`} />
              <span>{isClearing ? 'Temizleniyor...' : 'Hataları Temizle'}</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* ─── Queue Stat Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Publish Queue</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-['Outfit']">
              {jobs.publish.length}
            </span>
            <span className="text-xs text-slate-400">Bekleyen / Aktif İş</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            X ve Meta Graph API kuyruk slotları
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Fetch Queue</span>
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-['Outfit']">
              {jobs.fetch.length}
            </span>
            <span className="text-xs text-slate-400">Sistem Görevi</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            15 dk RSS Tarama + Sabah 06:30 Yayın Planı
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Hatalı İşler</span>
            <span
              className={`w-2 h-2 rounded-full ${
                failedJobs.length > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-700'
              }`}
            ></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-['Outfit']">
              {failedJobs.length}
            </span>
            <span className="text-xs text-rose-400">Hata Bildirimi</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Tek tıkla yeniden denenebilir (BullMQ Retry)
          </p>
        </div>
      </div>

      {/* ─── Jobs Filter Tabs ──────────────────────────────────────────────── */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Kuyruk İşleri
            </span>
          </div>

          <div className="flex p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 font-semibold rounded-lg transition ${
                activeTab === 'all'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tümü ({allJobs.length})
            </button>
            <button
              onClick={() => setActiveTab('publish')}
              className={`px-3 py-1 font-semibold rounded-lg transition ${
                activeTab === 'publish'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Publish ({jobs.publish.length})
            </button>
            <button
              onClick={() => setActiveTab('fetch')}
              className={`px-3 py-1 font-semibold rounded-lg transition ${
                activeTab === 'fetch'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fetch ({jobs.fetch.length})
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`px-3 py-1 font-semibold rounded-lg transition ${
                activeTab === 'failed'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hatalılar ({failedJobs.length})
            </button>
          </div>
        </div>

        {/* ─── Jobs List ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            İş kuyrukları taranıyor...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-900/40 border border-slate-800">
            <Activity className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            Bu filtrede bekleyen veya aktif bir işlem yok. Sistem stabil çalışıyor.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredJobs.map(({ queue, job }) => {
              const isFailed = !!job.failedReason;
              const hasDelay = job.delay && job.delay > 0;
              const isRetrying = retryingJobId === job.id;

              return (
                <div
                  key={`${queue}-${job.id}`}
                  className={`p-4 rounded-xl border transition ${
                    isFailed
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          queue === 'publish'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : queue === 'fetch'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {queue}
                      </span>
                      <span className="text-xs font-bold text-white font-mono">
                        #{job.id} • {job.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(job.timestamp).toLocaleTimeString('tr-TR')}</span>
                      {hasDelay && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                          Gecikme: {Math.round(job.delay! / 1000)} sn
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Job Payload Details */}
                  {job.data && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {job.data.tweetText ? (
                        <div className="line-clamp-2 text-slate-200">
                          {job.data.tweetText}
                        </div>
                      ) : (
                        <pre className="m-0 text-slate-400 whitespace-pre-wrap">
                          {JSON.stringify(job.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Failed Reason & Retry Button */}
                  {isFailed && (
                    <div className="mt-3 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-rose-300 font-mono">
                        <span className="font-bold">Hata:</span> {job.failedReason}
                      </div>

                      <button
                        onClick={() => handleRetry(queue, job.id)}
                        disabled={isRetrying}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition cursor-pointer disabled:opacity-50 self-end sm:self-auto"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>{isRetrying ? 'Yeniden Başlatılıyor...' : 'Yeniden Dene'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
