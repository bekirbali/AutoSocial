import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation, type TabType } from './components/Navigation';
import { OverviewView } from './views/OverviewView';
import { KanbanView } from './views/KanbanView';
import { DigestStudioView } from './views/DigestStudioView';
import { QueuesView } from './views/QueuesView';
import { SettingsView } from './views/SettingsView';
import type { OverviewResponse, ArticleItem } from './types/api';
import {
  fetchOverview,
  fetchArticles,
  fetchDigestCandidates,
  triggerManualFetch,
} from './lib/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [digestCandidatesCount, setDigestCandidatesCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggeringFetch, setIsTriggeringFetch] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [overviewData, articlesData, candidatesData] = await Promise.all([
        fetchOverview().catch((err) => {
          console.error('Overview error:', err);
          return null;
        }),
        fetchArticles().catch((err) => {
          console.error('Articles error:', err);
          return [];
        }),
        fetchDigestCandidates().catch((err) => {
          console.error('Candidates error:', err);
          return [];
        }),
      ]);

      if (overviewData) setOverview(overviewData);
      if (articlesData) setArticles(articlesData);
      if (candidatesData) setDigestCandidatesCount(candidatesData.length);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // 25 saniyede bir sessiz arka plan güncellemesi
    const timer = setInterval(() => {
      loadData(true);
    }, 25000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleManualFetch = async () => {
    setIsTriggeringFetch(true);
    try {
      await triggerManualFetch();
      setTimeout(() => {
        loadData(true);
      }, 2500);
    } catch (err: any) {
      alert(`Tarama tetiklenemedi: ${err.message}`);
    } finally {
      setIsTriggeringFetch(false);
    }
  };

  const pendingArticlesCount = articles.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#070A11] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* ─── Top Brand Header ──────────────────────────────────────────────── */}
      <Header
        overview={overview}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
      />

      {/* ─── Navigation Bar ────────────────────────────────────────────────── */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={pendingArticlesCount}
        digestCandidatesCount={digestCandidatesCount}
      />

      {/* ─── Main Viewport ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewView
            overview={overview}
            onNavigateTab={setActiveTab}
            onTriggerFetch={handleManualFetch}
            isTriggeringFetch={isTriggeringFetch}
          />
        )}

        {activeTab === 'kanban' && (
          <KanbanView
            articles={articles}
            onRefresh={() => loadData(false)}
          />
        )}

        {activeTab === 'digest' && <DigestStudioView />}

        {activeTab === 'queues' && <QueuesView />}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <b>DonanımPost</b> • Otonom Teknoloji Haberciliği & Sosyal Medya Motoru
          </span>
          <span className="text-[11px] text-slate-600">
            PostgreSQL • Redis • BullMQ • Sharp 16:9 • FFmpeg Reels • Gemini Flash
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
