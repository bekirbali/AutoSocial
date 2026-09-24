import React, { useState } from 'react';
import {
  Send,
  Clock,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Check,
  X,
  RefreshCw,
  Star,
  Undo2,
} from 'lucide-react';
import type { ArticleItem } from '../types/api';
import { postArticleAction, reRenderCard } from '../lib/api';

interface KanbanViewProps {
  articles: ArticleItem[];
  onRefresh: () => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({ articles, onRefresh }) => {
  const [activeModalArticle, setActiveModalArticle] = useState<ArticleItem | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // Sütun filtreleri
  const pendingArticles = articles.filter((a) => a.status === 'pending');
  const preApprovedArticles = articles.filter((a) => a.status === 'pre_approved');
  const scheduledArticles = articles.filter((a) => a.status === 'approved');
  const publishedArticles = articles.filter((a) => a.status === 'published');

  const handleAction = async (
    id: string,
    action: 'publish_now' | 'schedule' | 'reject' | 'pre_approve' | 'un_pre_approve',
  ) => {
    try {
      setIsActing(true);
      await postArticleAction(id, action);
      await onRefresh();
    } catch (err: any) {
      alert(`Hata: ${err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  const openEditModal = (article: ArticleItem) => {
    setActiveModalArticle(article);
    setEditText(article.tweetText);
    setEditTitle(article.translatedTitle || article.rawTitle);
  };

  const handleSaveEdit = async () => {
    if (!activeModalArticle) return;
    try {
      setIsActing(true);
      await postArticleAction(activeModalArticle.id, 'update', {
        tweetText: editText,
        translatedTitle: editTitle,
      });
      setActiveModalArticle(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Güncelleme hatası: ${err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  const handleReRenderCard = async () => {
    if (!activeModalArticle) return;
    try {
      setIsRendering(true);
      const newCardUrl = await reRenderCard(activeModalArticle.id, {
        title: editTitle,
      });
      setActiveModalArticle({
        ...activeModalArticle,
        cardImageUrl: newCardUrl,
        translatedTitle: editTitle,
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Kart render hatası: ${err.message}`);
    } finally {
      setIsRendering(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'gpu':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'cpu':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'mobile':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'gaming':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'deals':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Başlık & İstatistik Çubuğu */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white font-['Outfit'] m-0">
            İçerik Akışı & Kanban Kuyruğu
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Onay bekleyen haberleri yönetin, sıraya alın veya canlı düzenleyin
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Bekleyen: <strong className="text-amber-400">{pendingArticles.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-800/60 text-purple-200">
            Ön Onay: <strong className="text-purple-400">{preApprovedArticles.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Sırada: <strong className="text-cyan-400">{scheduledArticles.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Yayınlanan: <strong className="text-emerald-400">{publishedArticles.length}</strong>
          </span>
        </div>
      </div>

      {/* ─── 4 Sütunlu Kanban Tahtası ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* SÜTUN 1: ONAY BEKLEYENLER (GELEN HAVUZ) */}
        <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3.5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
              <h3 className="text-sm font-bold text-slate-200 m-0">Onay Bekleyenler</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
              {pendingArticles.length}
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {pendingArticles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Şu anda onay bekleyen yeni haber yok.
              </div>
            ) : (
              pendingArticles.map((article) => (
                <div
                  key={article.id}
                  className="glass-card rounded-xl p-3 space-y-2.5 border-slate-800/80 hover:border-amber-500/30 transition group"
                >
                  {/* Üst Bilgi: Kaynak, Kategori, Skor */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 truncate max-w-[120px]" title={article.sourceName || 'Haber'}>
                      {article.sourceName || 'Haber'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getCategoryColor(article.category)}`}>
                        {article.category.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-cyan-300">
                        ⭐ {Number(article.score).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Görsel Önizleme */}
                  {article.cardImageUrl ? (
                    <div
                      onClick={() => setPreviewImageModal(article.cardImageUrl)}
                      className="relative rounded-lg overflow-hidden aspect-video bg-slate-950 border border-slate-800 cursor-pointer group/img"
                    >
                      <img
                        src={article.cardImageUrl}
                        alt="16:9 Kart"
                        className="w-full h-full object-cover transition group-hover/img:scale-105 duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition text-xs font-semibold text-white gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Büyüt
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-950 rounded-lg text-xs text-slate-500 text-center border border-dashed border-slate-800">
                      Görsel Şablon
                    </div>
                  )}

                  {/* Tweet Metni */}
                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">
                    {article.tweetText}
                  </p>

                  {/* Aksiyon Butonları */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-800/60">
                    {/* Ön Onaya Al (Ana Seçim Butonu) */}
                    <button
                      onClick={() => handleAction(article.id, 'pre_approve')}
                      disabled={isActing}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-950/40 transition cursor-pointer disabled:opacity-50"
                      title="Ön Onay Havuzuna Ekle"
                    >
                      <Star className="w-3.5 h-3.5 fill-purple-200 text-purple-200" />
                      <span>Ön Onaya Al</span>
                    </button>

                    {/* Hızlı İkincil Aksiyonlar */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => handleAction(article.id, 'publish_now')}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1 py-1 px-1 rounded-md bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/50 text-cyan-300 text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                        title="Acil X'te Paylaş"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>Hemen</span>
                      </button>
                      <button
                        onClick={() => openEditModal(article)}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1 py-1 px-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer"
                      >
                        <Edit3 className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Düzenle</span>
                      </button>
                      <button
                        onClick={() => handleAction(article.id, 'reject')}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1 py-1 px-1 rounded-md bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 text-[11px] font-medium transition cursor-pointer"
                        title="Pas Geç / Çöp Kutusu"
                      >
                        <X className="w-2.5 h-2.5" />
                        <span>Pas</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SÜTUN 2: ÖN ONAYLILAR (SEÇİLENLER / HAZIR HAVUZ) */}
        <div className="flex flex-col h-full bg-purple-950/15 border border-purple-800/40 rounded-2xl p-3.5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-900/40">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-400"></div>
              <h3 className="text-sm font-bold text-slate-100 m-0">Ön Onaylılar</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-semibold bg-purple-500/15 text-purple-300 rounded-full border border-purple-500/30">
              {preApprovedArticles.length}
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {preApprovedArticles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs px-2">
                Ön onayda bekleyen haber yok.
                <span className="text-[11px] text-slate-600 mt-1.5 block">
                  Sol taraftan beğendiğiniz haberleri <strong>"Ön Onaya Al"</strong> ile buraya toplayın.
                </span>
              </div>
            ) : (
              preApprovedArticles.map((article) => (
                <div
                  key={article.id}
                  className="glass-card rounded-xl p-3 space-y-2.5 border-purple-500/30 hover:border-purple-500/60 bg-slate-900/80 transition group"
                >
                  {/* Üst Bilgi: Kaynak, Kategori, Skor */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 truncate max-w-[120px]" title={article.sourceName || 'Haber'}>
                      {article.sourceName || 'Haber'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getCategoryColor(article.category)}`}>
                        {article.category.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-purple-300">
                        ⭐ {Number(article.score).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Görsel Önizleme */}
                  {article.cardImageUrl ? (
                    <div
                      onClick={() => setPreviewImageModal(article.cardImageUrl)}
                      className="relative rounded-lg overflow-hidden aspect-video bg-slate-950 border border-slate-800 cursor-pointer group/img"
                    >
                      <img
                        src={article.cardImageUrl}
                        alt="16:9 Kart"
                        className="w-full h-full object-cover transition group-hover/img:scale-105 duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition text-xs font-semibold text-white gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Büyüt
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-950 rounded-lg text-xs text-slate-500 text-center border border-dashed border-slate-800">
                      Görsel Şablon
                    </div>
                  )}

                  {/* Tweet Metni */}
                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">
                    {article.tweetText}
                  </p>

                  {/* Aksiyon Butonları */}
                  <div className="space-y-1.5 pt-1.5 border-t border-purple-900/40">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => handleAction(article.id, 'publish_now')}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                        title="Anında X'te Paylaş"
                      >
                        <Send className="w-3 h-3" />
                        <span>Hemen At</span>
                      </button>
                      <button
                        onClick={() => handleAction(article.id, 'schedule')}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                        title="Boş Slota Sırala"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Sıraya Al</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => openEditModal(article)}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-cyan-400" />
                        <span>Düzenle</span>
                      </button>
                      <button
                        onClick={() => handleAction(article.id, 'un_pre_approve')}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 text-xs font-medium transition cursor-pointer"
                        title="Ön Onaydan Çıkar, Bekleyenler Havuzuna Geri Gönder"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>Geri Bırak</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SÜTUN 3: ZAMANLANMIŞ KUYRUK */}
        <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3.5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
              <h3 className="text-sm font-bold text-slate-200 m-0">Zamanlanmış Kuyruk</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
              {scheduledArticles.length}
            </span>
          </div>

          <div className="space-y-3.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {scheduledArticles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Kuyrukta bekleyen zamanlanmış tweet yok.
              </div>
            ) : (
              scheduledArticles.map((article) => (
                <div
                  key={article.id}
                  className="glass-card rounded-xl p-3.5 space-y-2.5 border-slate-800/80"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 truncate max-w-[130px]">
                      {article.sourceName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      ONAYLANDI
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                    {article.tweetText}
                  </p>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/60 text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" /> Planlı Gönderim
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAction(article.id, 'reject')}
                        disabled={isActing}
                        className="px-2 py-1 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 text-[11px] font-medium rounded-md transition cursor-pointer"
                        title="Kuyruktan Çıkar / İptal Et"
                      >
                        Pas Geç
                      </button>
                      <button
                        onClick={() => handleAction(article.id, 'publish_now')}
                        disabled={isActing}
                        className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-[11px] font-semibold rounded-md transition cursor-pointer"
                        title="Hemen X'te Paylaş"
                      >
                        Şimdi Ateşle
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SÜTUN 4: YAYINLANANLAR */}
        <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3.5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              <h3 className="text-sm font-bold text-slate-200 m-0">Yayınlananlar (X)</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              {publishedArticles.length}
            </span>
          </div>

          <div className="space-y-3.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {publishedArticles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Bugün henüz yayınlanan tweet yok.
              </div>
            ) : (
              publishedArticles.map((article) => (
                <div
                  key={article.id}
                  className="glass-card rounded-xl p-3.5 space-y-2.5 border-slate-800/80"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 truncate max-w-[130px]">
                      {article.sourceName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> X'te Canlı
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                    {article.tweetText}
                  </p>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/60 text-xs">
                    <span className="text-[11px] text-slate-500">
                      {article.tweetPublishedAt
                        ? new Date(article.tweetPublishedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                    {article.tweetUrl && (
                      <a
                        href={article.tweetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition"
                      >
                        <span>Tweet'e Git</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── DÜZENLEME & KART YENİLEME MODALI ──────────────────────────────── */}
      {activeModalArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 border-slate-700 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-['Outfit'] m-0">
                  Haber Metni & Canlı Kart Editörü
                </h3>
              </div>
              <button
                onClick={() => setActiveModalArticle(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Kart Önizleme */}
              {activeModalArticle.cardImageUrl && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                    16:9 Sharp Görsel Kartı (Canlı Önizleme)
                  </label>
                  <div className="rounded-xl overflow-hidden aspect-video bg-black border border-slate-800 relative">
                    <img
                      src={activeModalArticle.cardImageUrl}
                      alt="Card Preview"
                      className="w-full h-full object-cover"
                    />
                    {isRendering && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-semibold gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                        Kart Yeniden Render Ediliyor...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Kart Başlığı */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Kart Üzerindeki Başlık (Sharp TR)
                  </label>
                  <button
                    onClick={handleReRenderCard}
                    disabled={isRendering}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRendering ? 'animate-spin' : ''}`} />
                    Kartı Yenile (Render)
                  </button>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition font-medium"
                />
              </div>

              {/* Tweet Metni */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Tweet Metni (Max 270 Karakter - Sıfır Hashtag)
                </label>
                <textarea
                  rows={4}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition leading-relaxed font-normal resize-none"
                />
                <div className="mt-1 text-right text-xs text-slate-500">
                  {editText.length} / 270 karakter
                </div>
              </div>
            </div>

            {/* Modal Butonları */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveModalArticle(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isActing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Kaydet & Güncelle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BÜYÜK GÖRSEL ÖNİZLEME MODALI ──────────────────────────────────── */}
      {previewImageModal && (
        <div
          onClick={() => setPreviewImageModal(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 cursor-pointer"
        >
          <div className="max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden border border-slate-800">
            <img src={previewImageModal} alt="Preview" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
