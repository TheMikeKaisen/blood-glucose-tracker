import React from 'react';
import { Activity, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import type { ReportStats } from '../../types/report';
import { evaluateGlucose } from '../../utils/clinical';

interface SummaryCardsProps {
  stats: ReportStats;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  const hasData = stats.count > 0 && stats.average !== null;
  const avgEval = hasData ? evaluateGlucose(stats.average!) : null;

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {/* 1. Average Reading Card */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Activity className="w-4 h-4 text-teal-700" />
            <span className="text-xs font-semibold">Average Glucose</span>
          </div>
          {avgEval && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${avgEval.badgeClass}`}>
              {avgEval.label}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {hasData ? stats.average!.toFixed(1) : '—'}
          </span>
          <span className="text-xs font-semibold text-slate-500">mg/dL</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {hasData ? 'Standard 1-decimal arithmetic average' : 'No readings in period'}
        </p>
      </div>

      {/* 2. Total Count Card */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 col-span-2 sm:col-span-1">
        <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
          <Layers className="w-4 h-4 text-teal-700" />
          <span className="text-xs font-semibold">Total Readings</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {stats.count}
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {stats.count === 1 ? 'reading' : 'readings'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {hasData ? 'Logged across circadian slots' : 'No data recorded'}
        </p>
      </div>

      {/* 3. Highest Reading Card */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90">
        <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
          <ArrowUpRight className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-semibold">Highest</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {hasData && stats.highest !== null ? stats.highest : '—'}
          </span>
          <span className="text-xs font-semibold text-slate-500">mg/dL</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">Peak level observed</p>
      </div>

      {/* 4. Lowest Reading Card */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90">
        <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
          <ArrowDownRight className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold">Lowest</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {hasData && stats.lowest !== null ? stats.lowest : '—'}
          </span>
          <span className="text-xs font-semibold text-slate-500">mg/dL</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">Nadir level observed</p>
      </div>
    </div>
  );
};
