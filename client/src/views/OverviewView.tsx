import React from 'react';
import {
  Clock,
  CheckCircle2,
  Cpu,
  Zap,
  TrendingUp,
} from 'lucide-react';
import type { OverviewResponse } from '../types/api';

interface OverviewViewProps {
  overview: OverviewResponse | null;
  onNavigateTab: (tab: 'kanban' | 'digest' | 'queues' | 'settings') => void;
  onTriggerFetch: () => void;
  isTriggeringFetch: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  overview,
  onNavigateTab,
  onTriggerFetch,
  isTriggeringFetch,
}) => {
  if (!overview) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Kokpit verileri yükleniyor...</span>
        </div>
      </div>
    );
  }

  const { kpi, queues, system } = overview;

  return (
    <div className="space-y-6">
      {/* ─── 1. KPI Metric Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Published */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Bugün Paylaşılan (X)
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-['Outfit']">
              {kpi.todayPublished}
            </span>
            <span className="text-xs font-semibold text-slate-500">/ {kpi.maxTweets} Max</span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (kpi.todayPublished / kpi.maxTweets) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Remaining Quota */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Kalan Günlük Slot
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-['Outfit']">
              {kpi.quotaRemaining}
            </span>
            <span className="text-xs font-semibold text-emerald-400">Tweetlik Alan Var</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Algoritmik hız ve limit koruması aktif
          </p>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => onNavigateTab('kanban')}
          className="glass-card p-5 rounded-2xl relative overflow-hidden cursor-pointer hover:border-amber-500/40 transition group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-amber-300 transition">
              Onay Bekleyenler
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-['Outfit']">
              {kpi.pendingCount}
            </span>
            <span className="text-xs font-semibold text-amber-400">İncelenmeyi Bekliyor</span>
          </div>
          <p className="mt-3 text-xs text-slate-400 group-hover:text-slate-300">
            Kuyrukta kararınızı bekleyen makaleler →
          </p>
        </div>

        {/* Scheduled Slots */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Zamanlanmış Kuyruk
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-['Outfit']">
              {kpi.scheduledCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">Sıradaki Slotlar</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Günün planına uygun saatlerde atılacak
          </p>
        </div>
      </div>

      {/* ─── 2. Active Workers Pulse & Health ───────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white font-['Outfit'] m-0">
              Canlı Sistem & Worker Nabzı
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              BullMQ kuyrukları ve 4 otonom alt servis durumu
            </p>
          </div>
          <button
            onClick={onTriggerFetch}
            disabled={isTriggeringFetch}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isTriggeringFetch ? 'animate-spin' : ''}`} />
            <span>{isTriggeringFetch ? 'Taranıyor...' : 'Manuel RSS Tara'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Worker 1: Fetch */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-200">1. Fetch Worker</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400">24 Aktif RSS Kaynağı</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-2">
              <span>Periyot:</span>
              <span className="text-cyan-400 font-medium">15 Dakikada Bir</span>
            </div>
          </div>

          {/* Worker 2: Process */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-200">2. Process Worker</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400">Gemini AI + Sharp 16:9</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-2">
              <span>Durum:</span>
              <span className="text-indigo-400 font-medium">Aktif Dinlemede</span>
            </div>
          </div>

          {/* Worker 3: Publish */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-200">3. Publish Worker</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400">X (Twitter) + Meta Graph</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-2">
              <span>Gecikmeli İşler:</span>
              <span className="text-emerald-400 font-medium">{queues.publish.delayed} Adet</span>
            </div>
          </div>

          {/* Worker 4: Analytics & Digest */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-200">4. Reels & Digest</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400">FFmpeg Video Derleyici</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-2">
              <span>Otomatik Saatler:</span>
              <span className="text-amber-400 font-medium">13:00 ve 19:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. Quick Navigation Hub ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Digest Studio Promo */}
        <div
          onClick={() => onNavigateTab('digest')}
          className="glass-card p-6 rounded-2xl cursor-pointer hover:border-cyan-500/50 transition relative overflow-hidden group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white m-0 font-['Outfit'] group-hover:text-cyan-400 transition">
                Reels & Bülten Stüdyosu
              </h3>
              <p className="text-xs text-slate-400">7 Slayta kadar çoklu video derleyici</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Bugün X'te paylaşılan haberleri seçin, sürükleyerek sıralayın, ritmik müzikle 
            derleyip tarayıcıda canlı izleyin ve tek tıkla Instagram Reels olarak yayınlayın.
          </p>
          <div className="mt-4 flex items-center text-xs font-semibold text-cyan-400 gap-1 group-hover:translate-x-1 transition-transform">
            <span>Stüdyoya Git</span>
            <span>→</span>
          </div>
        </div>

        {/* Content Queue Promo */}
        <div
          onClick={() => onNavigateTab('kanban')}
          className="glass-card p-6 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition relative overflow-hidden group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white m-0 font-['Outfit'] group-hover:text-indigo-400 transition">
                Yayın Takvimi & Kanban
              </h3>
              <p className="text-xs text-slate-400">Onay, planlama ve canlı kart düzenleme</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Onay bekleyen {kpi.pendingCount} haberi inceleyin. Tek tıkla hemen yayınlayın, 
            günün boş saatlerine sıraya alın veya başlığı değiştirip Sharp kartını canlı güncelleyin.
          </p>
          <div className="mt-4 flex items-center text-xs font-semibold text-indigo-400 gap-1 group-hover:translate-x-1 transition-transform">
            <span>Kuyruğu Aç</span>
            <span>→</span>
          </div>
        </div>
      </div>

      {/* ─── 4. System Status Footer Info ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-500 font-mono">
        <div>
          <span>Sunucu Saati: </span>
          <span className="text-slate-300 font-medium">
            {new Date(system.serverTime).toLocaleTimeString('tr-TR')}
          </span>
        </div>
        <div>
          <span>Instagram Entegrasyonu: </span>
          <span className={system.enableInstagram ? 'text-emerald-400' : 'text-slate-400'}>
            {system.enableInstagram ? 'Aktif' : 'Pasif'}
          </span>
        </div>
        <div>
          <span>Genel URL: </span>
          <span className="text-cyan-400">{system.publicUrl || 'http://localhost:3000'}</span>
        </div>
      </div>
    </div>
  );
};
