import React from 'react';
import {
  LayoutDashboard,
  Kanban,
  Film,
  Server,
  Sliders,
} from 'lucide-react';

export type TabType = 'overview' | 'kanban' | 'digest' | 'queues' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  pendingCount: number;
  digestCandidatesCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  pendingCount,
  digestCandidatesCount,
}) => {
  const tabs = [
    {
      id: 'overview' as TabType,
      label: 'Genel Bakış',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'kanban' as TabType,
      label: 'Yayın Kuyruğu',
      icon: Kanban,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'digest' as TabType,
      label: 'Reels & Bülten Stüdyosu',
      icon: Film,
      badge: digestCandidatesCount > 0 ? `${digestCandidatesCount} Aday` : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'queues' as TabType,
      label: 'Kuyruklar & İşler',
      icon: Server,
      badge: null,
    },
    {
      id: 'settings' as TabType,
      label: 'Kaynaklar & Ayarlar',
      icon: Sliders,
      badge: null,
    },
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${tab.badgeColor}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
