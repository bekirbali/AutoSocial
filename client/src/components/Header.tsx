import React, { useState } from 'react';
import { RefreshCw, ShieldCheck, Zap, Hand, Loader2 } from 'lucide-react';
import type { OverviewResponse } from '../types/api';
import { toggleXManualMode } from '../lib/api';

interface HeaderProps {
  overview: OverviewResponse | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  overview,
  onRefresh,
  isRefreshing,
}) => {
  const [isToggling, setIsToggling] = useState(false);
  const isManualMode = overview?.system.xManualMode ?? false;

  const handleToggleManualMode = async () => {
    setIsToggling(true);
    try {
      await toggleXManualMode(!isManualMode);
      onRefresh();
    } catch (err: any) {
      alert(`X yayınlama modu güncellenemedi: ${err.message}`);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <span className="font-black text-white text-lg tracking-tighter">DP</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white m-0 font-['Outfit']">
                Donanım<span className="text-cyan-400">Post</span>
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                KOKPİT v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Otonom Teknoloji Medyası & Bülten Merkezi</p>
          </div>
        </div>

        {/* Live Badges & Quick Stats */}
        <div className="flex items-center gap-3">
          {/* X (Twitter) Yayınlama Modu Toggle Butonu */}
          <button
            onClick={handleToggleManualMode}
            disabled={isToggling}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-60 ${
              isManualMode
                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
            }`}
            title={
              isManualMode
                ? 'X Manuel Mod Devrede (0 TL): X API çağrıları kapalıdır. Tweetleri elle paylaşıp panelden/Telegramdan onaylayabilirsiniz. Tıklayarak Otomatik API moduna geçebilirsiniz.'
                : 'X Otomatik Mod Devrede: Tweetler X API ile otomatik paylaşılır. Bakiye bittiğinde tıklayarak Manuel (0 TL) moda geçebilirsiniz.'
            }
          >
            {isToggling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            ) : isManualMode ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <Hand className="w-3.5 h-3.5 text-amber-400" />
                <span>X: Manuel (0 TL)</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>X: Otomatik API</span>
              </>
            )}
          </button>

          {/* Mode Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mod:</span>
            <span className="text-white font-semibold capitalize">
              {overview?.system.mode || 'Hibrit'}
            </span>
          </div>

          {/* Cloudflare Tunnel Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden md:inline text-slate-400">Tünel:</span>
            <span className="font-mono text-emerald-400 text-[11px] font-medium truncate max-w-[140px]">
              {overview?.system.publicUrl ? 'Cloudflare Aktif' : 'Lokal Port 3000'}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            title="Verileri Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
        </div>
      </div>
    </header>
  );
};

