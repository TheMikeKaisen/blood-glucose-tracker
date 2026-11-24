import React from 'react';
import { Calendar, BarChart3, HeartPulse } from 'lucide-react';

export type NavTab = 'readings' | 'reports' | 'clinical';

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    {
      id: 'readings' as NavTab,
      label: 'Readings',
      icon: Calendar,
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports',
      icon: BarChart3,
    },
    {
      id: 'clinical' as NavTab,
      label: 'Targets',
      icon: HeartPulse,
    },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 safe-area-bottom shadow-lg"
    >
      <div className="max-w-md mx-auto grid grid-cols-3 px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-2 rounded-xl transition-transform active:scale-95 ${
                isActive
                  ? 'text-teal-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-lg ${
                  isActive ? 'bg-teal-50' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
