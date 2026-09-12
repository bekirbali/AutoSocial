import React, { useState, useEffect } from 'react';
import {
  Settings,
  Rss,
  Shield,
  Tag,
  Globe,
  Star,
  ExternalLink,
  Server,
  Terminal,
} from 'lucide-react';
import type { SourceItem } from '../types/api';
import { fetchSettings } from '../lib/api';

export const SettingsView: React.FC = () => {
  const [data, setData] = useState<{
    sources: SourceItem[];
    categories: string[];
    keywords: Record<string, string[]>;
    env: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetchSettings();
      setData(res);
      if (res.categories && res.categories.length > 0) {
        setSelectedCategory(res.categories[0]!);
      }
    } catch (err: any) {
      console.error('Ayarlar yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Sistem ayarları yükleniyor...</span>
        </div>
      </div>
    );
  }

  const { sources, categories, keywords, env } = data;

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-5 rounded-2xl">
        <h1 className="text-xl font-bold text-white font-['Outfit'] m-0 flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          Sistem Mimarisi & Kaynak Yönetimi
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          DonanımPost otonom haber kaynakları, puanlama anahtar kelimeleri ve sistem parametreleri.
        </p>
      </div>

      {/* ─── 1. Brand & Architectural Invariants ────────────────────────────── */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Marka ve Mimari Değişmezler (Invariants)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Resmi Marka</span>
            <div className="text-sm font-bold text-white mt-1">DonanımPost</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Tüm görsel, kart ve video şablonlarında tek isimdir.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">X (Twitter) Kuralı</span>
            <div className="text-sm font-bold text-cyan-400 mt-1">0 Hashtag & Zincirsiz</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Maks 240-270 karakter tek parça kanca tweet.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Instagram Bülteni</span>
            <div className="text-sm font-bold text-pink-400 mt-1">Günde 2 Reels (Maks 7 Slayt)</div>
            <p className="text-[11px] text-slate-500 mt-1">
              13:00 Öğle & 19:00 Akşam ritmik müzikli özetler.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Min Skor Eşiği</span>
            <div className="text-sm font-bold text-amber-400 mt-1">85 / 100 Puan</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Freshness %40 + Keyword %30 + Kaynak %20 + AI %10
            </p>
          </div>
        </div>

        {/* Runtime Env Details */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span>Mod: <b className="text-slate-200">{env.appMode}</b></span>
          </div>
          <div>
            <span>Aktif Skor Filtresi: <b className="text-amber-400">{env.minScoreThreshold ?? 90}</b></span>
          </div>
          <div>
            <span>Günlük Maksimum X: <b className="text-slate-200">{env.maxTweetsPerDay}</b></span>
          </div>
          <div>
            <span>Tarama Sıklığı: <b className="text-slate-200">{env.fetchIntervalMinutes} dk</b></span>
          </div>
          <div>
            <span>Instagram: <b className="text-emerald-400">{env.enableInstagram ? 'Aktif' : 'Pasif'}</b></span>
          </div>
        </div>
      </div>

      {/* ─── 2. Active RSS & Media Sources ───────────────────────────────────── */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Rss className="w-4 h-4 text-cyan-400" />
              Aktif RSS ve İçerik Kaynakları ({sources.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              PC Donanım, Mobil (Apple, Samsung), Oyun ve Fırsat akışları
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sources.map((src) => (
            <div
              key={src.id}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  {src.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase">
                  {src.lang}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-medium">Güvenilirlik:</span>
                <div className="flex items-center text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < src.reliability ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {src.categories.map((cat) => (
                  <span
                    key={cat}
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400"
                  >
                    #{cat}
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                <a
                  href={src.rssUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 flex items-center gap-1 truncate max-w-[200px]"
                >
                  <Terminal className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{src.rssUrl}</span>
                </a>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white flex-shrink-0 ml-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 3. Categories & Filtering Keywords ─────────────────────────────── */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" />
            Kategori ve Anahtar Kelime Radarı
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Otomatik sınıflandırma ve yapay zeka puanlama tetikleyicileri
          </p>
        </div>

        {/* Category Pill Tabs */}
        <div className="flex flex-wrap gap-2 pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat} ({keywords[cat]?.length || 0})
            </button>
          ))}
        </div>

        {/* Selected Category Keyword Chips */}
        {selectedCategory && keywords[selectedCategory] && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              "{selectedCategory}" Puanlama Kelimeleri:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords[selectedCategory].map((kw) => (
                <span
                  key={kw}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-cyan-300 border border-slate-700/60 shadow-sm"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
