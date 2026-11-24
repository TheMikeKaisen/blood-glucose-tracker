import React from 'react';
import { Droplet, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onOpenClinicalInfo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenClinicalInfo }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 safe-area-top">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
            <Droplet className="w-5 h-5 fill-white/20 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-slate-900 tracking-tight">
                Sweety
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">
                ADA Calibrated
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Blood Glucose Tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenClinicalInfo && (
            <button
              type="button"
              onClick={onOpenClinicalInfo}
              title="View ADA Clinical Targets"
              aria-label="View ADA Clinical Targets"
              className="p-2 text-slate-500 hover:text-teal-700 rounded-xl hover:bg-slate-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-transform active:scale-95"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          )}

          {user && (
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {user.name}
                </p>
                <p className="text-[10px] text-slate-500 truncate max-w-[120px]">
                  {user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Log out"
                aria-label="Log out"
                className="p-2 text-slate-500 hover:text-rose-600 rounded-xl hover:bg-rose-50 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-transform active:scale-95"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
