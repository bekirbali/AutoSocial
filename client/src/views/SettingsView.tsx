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
  Zap,
  Hand,
  Loader2,
  Sliders,
  Save,
  Check,
  Cpu,
} from 'lucide-react';
import type { SourceItem } from '../types/api';
import { fetchSettings, toggleXManualMode, updateDynamicSettings } from '../lib/api';

export const SettingsView: React.FC = () => {
  const [data, setData] = useState<{
    sources: SourceItem[];
    categories: string[];
    keywords: Record<string, string[]>;
    xManualMode?: boolean;
    settings?: any;
    env: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [formSettings, setFormSettings] = useState({
    maxTweetsPerDay: 15,
    minScoreThreshold: 75,
    telegramMinScore: 85,
    fetchIntervalMinutes: 15,
    appMode: 'hybrid',
    enableInstagram: false,
    defaultGeminiModel: 'gemini-3.6-flash',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

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
      const s = (res as any).settings || res.env || {};
      setFormSettings({
        maxTweetsPerDay: s.maxTweetsPerDay ?? 15,
        minScoreThreshold: s.minScoreThreshold ?? 75,
        telegramMinScore: s.telegramMinScore ?? 85,
        fetchIntervalMinutes: s.fetchIntervalMinutes ?? 15,
        appMode: s.appMode ?? 'hybrid',
        enableInstagram: Boolean(s.enableInstagram),
        defaultGeminiModel: s.defaultGeminiModel ?? 'gemini-3.6-flash',
      });
    } catch (err: any) {
      console.error('Ayarlar yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleManualMode = async () => {
    if (!data) return;
    const nextState = !data.xManualMode;
    setIsUpdatingMode(true);
    try {
      await toggleXManualMode(nextState);
      setData({ ...data, xManualMode: nextState });
    } catch (err: any) {
      alert(`X yayınlama modu güncellenemedi: ${err.message}`);
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveSuccessMsg(false);
    try {
      const updated = await updateDynamicSettings(formSettings);
      if (data) {
        setData({
          ...data,
          env: { ...data.env, ...updated },
        });
      }
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3500);
    } catch (err: any) {
      alert(`Ayarlar kaydedilemedi: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
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

  const { sources, categories, keywords } = data;

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-5 rounded-2xl">
        <h1 className="text-xl font-bold text-white font-['Outfit'] m-0 flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          Sistem Mimarisi & Kaynak Yönetimi
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          TeknoFiltre otonom haber kaynakları, puanlama anahtar kelimeleri ve sistem parametreleri.
        </p>
      </div>

      {/* ─── X API / Manuel Mod Yönetimi ────────────────────────────────────── */}

      <div className={`glass-card p-6 rounded-2xl border transition-all ${
        data.xManualMode ? 'border-amber-500/40 bg-amber-950/20' : 'border-cyan-500/30 bg-cyan-950/10'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 ${
              data.xManualMode ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40'
            }`}>
              {data.xManualMode ? <Hand className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-['Outfit'] m-0">
                  X (Twitter) Yayınlama Modu
                </h2>
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                  data.xManualMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                }`}>
                  {data.xManualMode ? '🖐 Manuel Mod (0 TL / Tasarruf)' : '⚡ Otomatik API Aktif'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                {data.xManualMode ? (
                  <>
                    <b className="text-amber-300">X API istekleri tamamen durduruldu.</b> Tweet metni ve görselini Telegram'dan veya kokpitten alıp X hesabına elle atabilirsiniz. Onaylanan haberler <b>13:00 ve 19:00 Instagram Reels bültenlerine eksiksiz dahil edilir</b> ve Instagram'a otomatik yüklenir.
                  </>
                ) : (
                  <>
                    Onaylanan tweetler ve görseller X Developer API v2 aracılığıyla otomatik paylaşılır. Bütçeniz bittiğinde veya tasarruf etmek istediğinizde tek tıkla <b className="text-amber-300">Manuel Moda</b> geçebilirsiniz.
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleManualMode}
            disabled={isUpdatingMode}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 shrink-0 ${
              data.xManualMode
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
          >
            {isUpdatingMode ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : data.xManualMode ? (
              <>
                <Zap className="w-4 h-4" />
                <span>Otomatik API Moduna Geç</span>
              </>
            ) : (
              <>
                <Hand className="w-4 h-4 text-amber-400" />
                <span>Manuel Moda Geç (0 TL)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Canlı Sistem Parametreleri & AI Fallback ───────────────────────── */}
      <form onSubmit={handleSaveSettings} className="glass-card p-6 rounded-2xl space-y-5 border border-indigo-500/20 bg-slate-900/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 m-0">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Canlı Operasyonel Parametreler & AI Fallback
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Değişiklikler Redis'e kaydedilir ve çalışan servise canlı yansır (Restart gerektirmez).
            </p>
          </div>
          <button
            type="submit"
            disabled={isSavingSettings}
            className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-900/20 disabled:opacity-50"
          >
            {isSavingSettings ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccessMsg ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSavingSettings ? 'Kaydediliyor...' : saveSuccessMsg ? 'Kaydedildi!' : 'Ayarları Kaydet'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Günlük Maks Tweet */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Günlük Maksimum Tweet</span>
              <span className="text-cyan-400 font-mono font-bold">{formSettings.maxTweetsPerDay}</span>
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={formSettings.maxTweetsPerDay}
              onChange={(e) => setFormSettings({ ...formSettings, maxTweetsPerDay: Number(e.target.value) })}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Günde yayınlanacak tavan tweet sayısı</p>
          </div>

          {/* Min Skor Eşiği (Admin Panel) */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Admin Panel Skor Eşiği</span>
              <span className="text-amber-400 font-mono font-bold">{formSettings.minScoreThreshold}</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={formSettings.minScoreThreshold}
              onChange={(e) => setFormSettings({ ...formSettings, minScoreThreshold: Number(e.target.value) })}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">75+ haberler işlenip Admin Panel'e gelir</p>
          </div>

          {/* Telegram Bildirim Eşiği */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Telegram Bildirim Eşiği</span>
              <span className="text-emerald-400 font-mono font-bold">{formSettings.telegramMinScore}</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={formSettings.telegramMinScore}
              onChange={(e) => setFormSettings({ ...formSettings, telegramMinScore: Number(e.target.value) })}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Yalnızca 85+ acil haberler Telegram'a düşer</p>
          </div>

          {/* RSS Tarama Aralığı */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>RSS Tarama Aralığı</span>
              <span className="text-slate-200 font-mono font-bold">{formSettings.fetchIntervalMinutes} dk</span>
            </label>
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={formSettings.fetchIntervalMinutes}
              onChange={(e) => setFormSettings({ ...formSettings, fetchIntervalMinutes: Number(e.target.value) })}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Kaynakların taranma periyodu (min 5 dk)</p>
          </div>

          {/* Çalışma Modu */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300">
              Çalışma Modu
            </label>
            <select
              value={formSettings.appMode}
              onChange={(e) => setFormSettings({ ...formSettings, appMode: e.target.value as any })}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value="hybrid">Hibrit (Telegram Onaylı)</option>
              <option value="automatic">Otomatik (Direkt Yayın)</option>
            </select>
            <p className="text-[10px] text-slate-500">Hibrit mod Telegram bot onayı bekler</p>
          </div>

          {/* Instagram Entegrasyonu */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300">
              Instagram Yayını
            </label>
            <select
              value={formSettings.enableInstagram ? 'true' : 'false'}
              onChange={(e) => setFormSettings({ ...formSettings, enableInstagram: e.target.value === 'true' })}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-pink-500 focus:outline-none cursor-pointer"
            >
              <option value="true">Aktif (Reels & Carousel)</option>
              <option value="false">Pasif (Yalnızca X)</option>
            </select>
            <p className="text-[10px] text-slate-500">13:00 ve 19:00 bülten yayınları</p>
          </div>

          {/* Varsayılan Gemini Modeli */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Gemini Modeli
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">3 Seviye Fallback</span>
            </label>
            <select
              value={formSettings.defaultGeminiModel}
              onChange={(e) => setFormSettings({ ...formSettings, defaultGeminiModel: e.target.value as any })}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="gemini-3.6-flash">gemini-3.6-flash (En Hızlı & Zeki)</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash (Dengeli)</option>
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Tasarruflu)</option>
            </select>
            <p className="text-[10px] text-slate-400 truncate">Hata/429'da otomatik alt modele düşer</p>
          </div>
        </div>
      </form>

      {/* ─── 1. Brand & Architectural Invariants ────────────────────────────── */}
      <div className="glass-card p-6 rounded-2xl space-y-4">

        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Marka ve Mimari Değişmezler (Invariants)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Resmi Marka</span>
            <div className="text-sm font-bold text-white mt-1">TeknoFiltre</div>
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
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Telegram Onay Eşiği</span>
            <div className="text-sm font-bold text-emerald-400 mt-1">{formSettings.telegramMinScore} / 100 Puan</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Yalnızca 85+ puanlı haberler Telegram bildirimine düşer.
            </p>
          </div>
        </div>

        {/* Runtime Env Details */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span>Mod: <b className="text-slate-200">{formSettings.appMode}</b></span>
          </div>
          <div>
            <span>Panel Eşiği: <b className="text-amber-400">{formSettings.minScoreThreshold}</b></span>
          </div>
          <div>
            <span>Telegram Eşiği: <b className="text-emerald-400">{formSettings.telegramMinScore}</b></span>
          </div>
          <div>
            <span>Günlük Maksimum X: <b className="text-slate-200">{formSettings.maxTweetsPerDay}</b></span>
          </div>
          <div>
            <span>Tarama Sıklığı: <b className="text-slate-200">{formSettings.fetchIntervalMinutes} dk</b></span>
          </div>
          <div>
            <span>Instagram: <b className="text-emerald-400">{formSettings.enableInstagram ? 'Aktif' : 'Pasif'}</b></span>
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
