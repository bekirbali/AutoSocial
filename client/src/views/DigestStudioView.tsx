import React, { useState, useEffect } from 'react';
import {
  Film,
  Play,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Sparkles,
  Send,
  RefreshCw,
  Clock,
  Layers,
  AlertCircle,
  Hash,
} from 'lucide-react';
import type { DigestCandidate, DigestResult } from '../types/api';
import {
  fetchDigestCandidates,
  composeDigest,
  publishDigestToInstagram,
  saveDigestOrder,
  sendDigestToTelegram,
} from '../lib/api';

export const DigestStudioView: React.FC = () => {
  const [candidates, setCandidates] = useState<DigestCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [digestType, setDigestType] = useState<'noon' | 'evening' | 'manual'>('manual');
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [orderSavedToast, setOrderSavedToast] = useState(false);
  const [composedDigest, setComposedDigest] = useState<DigestResult | null>(null);
  const [caption, setCaption] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'studio' | 'history'>('studio');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCandidates();
    loadHistory();
  }, []);

  const loadCandidates = async () => {
    setIsLoadingCandidates(true);
    try {
      const data = await fetchDigestCandidates();
      setCandidates(data);
      // Varsayılan olarak adayların ilk 7'sini (özel sıralamaya göre dizilmiş halini) seçili yap
      const defaultSelected = data.slice(0, 7).map((c) => c.id);
      setSelectedIds(defaultSelected);
    } catch (err: any) {
      console.error('Adaylar yüklenemedi:', err);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/admin/digest/history');
      const json = await res.json();
      if (json.success) {
        setHistory(json.data);
      }
    } catch (err) {
      console.error('Geçmiş yüklenemedi:', err);
    }
  };

  const toggleSelect = (id: string) => {
    let next: string[];
    if (selectedIds.includes(id)) {
      next = selectedIds.filter((item) => item !== id);
    } else {
      if (selectedIds.length >= 7) {
        alert('Instagram Reels bültenine en fazla 7 haber ekleyebilirsiniz.');
        return;
      }
      next = [...selectedIds, id];
    }
    setSelectedIds(next);
    saveDigestOrder(next).then(() => {
      setOrderSavedToast(true);
      setTimeout(() => setOrderSavedToast(false), 2500);
    }).catch(() => {});
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setSelectedIds(next);
    // Sıralamayı anında backend ve Redis'e kaydet
    saveDigestOrder(next).then(() => {
      setOrderSavedToast(true);
      setTimeout(() => setOrderSavedToast(false), 2500);
    }).catch((err) => console.warn('Sıralama kaydedilemedi:', err));
  };

  const handleCompose = async () => {
    if (selectedIds.length === 0) {
      alert('Lütfen en az bir haber seçin.');
      return;
    }

    setIsComposing(true);
    setStatusMessage(null);
    try {
      const result = await composeDigest(selectedIds, digestType);
      setComposedDigest(result);
      setCaption(result.caption);
      setStatusMessage({
        type: 'success',
        text: `Bülten başarıyla oluşturuldu! ${result.articleCount} haberli video hazır.`,
      });
      loadHistory();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Bülten derlenirken bir hata oluştu.',
      });
    } finally {
      setIsComposing(false);
    }
  };

  const handlePublish = async () => {
    if (!composedDigest) return;
    if (!confirm('Bu bülteni @bekirdev43 Instagram hesabında Reels olarak yayınlamak istediğinize emin misiniz?')) {
      return;
    }

    setIsPublishing(true);
    setStatusMessage(null);
    try {
      await publishDigestToInstagram(composedDigest.digestId);
      setStatusMessage({
        type: 'success',
        text: 'Bülten Instagram Reels olarak başarıyla yayınlandı!',
      });
      loadCandidates();
      loadHistory();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Instagram yayını başarısız oldu.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSendTelegram = async () => {
    if (!composedDigest) return;
    setIsSendingTelegram(true);
    setStatusMessage(null);
    try {
      await sendDigestToTelegram(composedDigest.digestId);
      setStatusMessage({
        type: 'success',
        text: 'Bülten Telegram onayına başarıyla gönderildi! Telegram uygulamanızdan videoyu inceleyip onaylayabilirsiniz.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Telegram onayına gönderilirken hata oluştu.',
      });
    } finally {
      setIsSendingTelegram(false);
    }
  };

  // Seçili haberleri sıralı olarak listele
  const orderedSelectedArticles = selectedIds
    .map((id) => candidates.find((c) => c.id === id))
    .filter(Boolean) as DigestCandidate[];

  return (
    <div className="space-y-6">
      {/* ─── Header & Mode Selector ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-['Outfit'] m-0 flex items-center gap-2">
              <Film className="w-5 h-5 text-pink-500" />
              Reels & Bülten Stüdyosu
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
              DonanımPost
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            X'te paylaşılan haberleri 9:16 formatında ritmik müzikli Instagram Reels bültenine dönüştürün.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-900/90 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'studio'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stüdyo & Derleme
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Geçmiş Bültenler ({history.length})
            </button>
          </div>
          <button
            onClick={() => {
              loadCandidates();
              loadHistory();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900/90 border border-slate-800 transition"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

      {activeTab === 'studio' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Sol Panel: Haber Seçimi ve Sıralama (7 Kolon) ──────────────── */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Bülten Adayları ({candidates.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Son bültenden bu yana X'te paylaşılan ve henüz bültende yer almamış haberler
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700">
                    {selectedIds.length} / 7 Seçildi
                  </span>
                </div>
              </div>

              {isLoadingCandidates ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Aday haberler taranıyor...
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-slate-800/80">
                  <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">
                    Bültene eklenecek yeni X haberi bulunamadı
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Bugün X'te yayınlanan tüm haberler daha önceki bültenlerde kullanılmış
                    veya henüz yeni bir haber yayınlanmamış.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {candidates.map((candidate) => {
                    const isSelected = selectedIds.includes(candidate.id);
                    const selectedIndex = selectedIds.indexOf(candidate.id);

                    return (
                      <div
                        key={candidate.id}
                        onClick={() => toggleSelect(candidate.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'bg-slate-900/90 border-pink-500/50 shadow-sm'
                            : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition ${
                            isSelected
                              ? 'bg-pink-600 text-white'
                              : 'border border-slate-700 bg-slate-800/80'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>

                        {/* Image Thumb */}
                        {candidate.rawImageUrl ? (
                          <img
                            src={candidate.rawImageUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-xs flex-shrink-0">
                            Yok
                          </div>
                        )}

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-200 line-clamp-1 leading-snug">
                            {candidate.displayTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {candidate.sourceName || 'Haber'}
                            </span>
                            <span className="text-[10px] text-slate-600">•</span>
                            <span className="text-[10px] text-cyan-400 font-semibold">
                              Skor: {candidate.score}
                            </span>
                            {isSelected && (
                              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                                Slayt {selectedIndex + 1}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Seçili Slaytları Sıralama & Konfigürasyon */}
            {orderedSelectedArticles.length > 0 && (
              <div className="glass-card p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Slayt Akış Sırası ({orderedSelectedArticles.length} Slayt)
                    </h3>
                    {orderSavedToast && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 transition">
                        <CheckCircle2 className="w-3 h-3" />
                        Sıralama Kaydedildi
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    Yaklaşık Video Süresi: ~{orderedSelectedArticles.length * 4.5} sn
                  </span>
                </div>

                <div className="space-y-2">
                  {orderedSelectedArticles.map((article, idx) => (
                    <div
                      key={article.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800"
                    >
                      <span className="w-6 h-6 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-xs text-slate-200 flex-1 truncate font-medium">
                        {article.displayTitle}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, 'up')}
                          className="p-1 rounded-md text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800"
                          title="Yukarı Taşı"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === orderedSelectedArticles.length - 1}
                          onClick={() => moveItem(idx, 'down')}
                          className="p-1 rounded-md text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800"
                          title="Aşağı Taşı"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:w-auto flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Bülten Tipi:</span>
                    <select
                      value={digestType}
                      onChange={(e: any) => setDigestType(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-pink-500"
                    >
                      <option value="noon">Öğle Bülteni</option>
                      <option value="evening">Akşam Bülteni</option>
                      <option value="manual">Özel / Anlık Bülten</option>
                    </select>
                  </div>

                  <button
                    onClick={handleCompose}
                    disabled={isComposing || orderedSelectedArticles.length === 0}
                    className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-4 h-4 ${isComposing ? 'animate-spin' : ''}`} />
                    <span>
                      {isComposing ? 'FFmpeg ile Derleniyor...' : 'Reels Bültenini Derle'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Sağ Panel: Reels Canlı Video & Caption Stüdyosu (5 Kolon) ── */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-5 rounded-2xl">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Play className="w-4 h-4 text-pink-400" />
                Canlı Reels Önizleme (9:16)
              </h3>

              {composedDigest ? (
                <div className="space-y-4">
                  {/* HTML5 Vertical Video Player */}
                  <div className="relative mx-auto max-w-[270px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border-2 border-pink-500/30 shadow-2xl shadow-pink-500/10">
                    <video
                      key={composedDigest.videoUrl}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                      src={composedDigest.videoUrl}
                    >
                      Tarayıcınız HTML5 video etiketini desteklemiyor.
                    </video>
                  </div>

                  {/* Slayt Küçük Resimleri */}
                  {composedDigest.slides && composedDigest.slides.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-semibold text-slate-400 mb-2">
                        Üretilen Slaytlar ({composedDigest.slides.length})
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {composedDigest.slides.map((slide, sIdx) => (
                          <img
                            key={sIdx}
                            src={slide}
                            alt={`Slide ${sIdx + 1}`}
                            className="w-14 h-24 object-cover rounded-lg border border-slate-800 flex-shrink-0 shadow"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Caption Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-pink-400" />
                        Instagram Açıklaması & Hashtagler
                      </label>
                      <span className="text-[10px] text-slate-400">Gemini AI</span>
                    </div>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={5}
                      className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-pink-500 resize-none font-sans leading-relaxed"
                      placeholder="Instagram Reels açıklaması..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleSendTelegram}
                      disabled={isSendingTelegram || isPublishing}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className={`w-4 h-4 ${isSendingTelegram ? 'animate-spin' : ''}`} />
                      <span>
                        {isSendingTelegram ? 'Telegram Onayına Gönderiliyor...' : 'Telegram Onayına Gönder (Bot)'}
                      </span>
                    </button>

                    <button
                      onClick={handlePublish}
                      disabled={isPublishing || isSendingTelegram}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <Film className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                      <span>
                        {isPublishing ? 'Instagram Reels Yükleniyor...' : 'Doğrudan Instagram\'da Paylaş'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 min-h-[380px] flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-3">
                    <Film className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">Reels Henüz Derlenmedi</h4>
                  <p className="text-xs text-slate-400 max-w-[240px] mt-1 leading-relaxed">
                    Soldaki panelden haberleri seçin ve "Reels Bültenini Derle" butonuna basın. 
                    Müzikli 9:16 video burada oynatılabilir hale gelecektir.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── Geçmiş Bültenler Listesi ────────────────────────────────────────── */
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Önceki Bülten Kayıtları
          </h3>

          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Henüz kaydedilmiş bir bülten bulunmuyor.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase">
                      {item.type === 'noon'
                        ? 'Öğle Bülteni'
                        : item.type === 'evening'
                        ? 'Akşam Bülteni'
                        : 'Özel Bülten'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'published'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.status === 'published' ? 'Yayınlandı' : 'Beklemede'}
                    </span>
                  </div>

                  {item.videoUrl && (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-800">
                      <video
                        controls
                        src={item.videoUrl}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                    {item.caption}
                  </p>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{new Date(item.createdAt).toLocaleString('tr-TR')}</span>
                    <span>{item.articleIds?.length || 0} Haber</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
