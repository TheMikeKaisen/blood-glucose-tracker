import React from 'react';
import { Check, Clock } from 'lucide-react';
import type { TimeSlot, Reading } from '../../types/reading';
import { CHRONOLOGICAL_SLOTS, SLOT_CONFIG } from '../../utils/clinical';

interface DailyProgressProps {
  readings: Reading[];
  onSlotClick?: (slot: TimeSlot) => void;
}

export const DailyProgress: React.FC<DailyProgressProps> = ({ readings, onSlotClick }) => {
  const loggedSlotMap = new Map<TimeSlot, Reading>();
  readings.forEach((r) => loggedSlotMap.set(r.slot, r));

  const loggedCount = readings.length;
  const progressPercent = Math.min(100, Math.round((loggedCount / 4) * 100));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Circadian Log
          </h2>
          <p className="text-sm font-semibold text-slate-900">
            {loggedCount === 4
              ? 'All 4 readings recorded today'
              : `${loggedCount} of 4 readings logged`}
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            loggedCount === 4
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-teal-50 text-teal-800 border border-teal-200'
          }`}
        >
          {progressPercent}% Complete
        </span>
      </div>

      {/* Visual Progress Bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-teal-600 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 4 Circadian Step Badges */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {CHRONOLOGICAL_SLOTS.map((slot) => {
          const config = SLOT_CONFIG[slot];
          const isLogged = loggedSlotMap.has(slot);
          const reading = loggedSlotMap.get(slot);

          return (
            <button
              key={slot}
              type="button"
              onClick={() => onSlotClick?.(slot)}
              className={`p-2 min-h-[44px] rounded-xl text-left border text-xs transition-transform active:scale-95 ${
                isLogged
                  ? 'bg-teal-50/70 border-teal-200/80 text-teal-900'
                  : 'bg-slate-50/70 border-slate-200 text-slate-500 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-slate-500 truncate">
                  {config.shortLabel}
                </span>
                {isLogged ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                )}
              </div>
              <div className="font-bold text-slate-900 text-xs">
                {isLogged && reading ? (
                  <span>{reading.value} <span className="text-[10px] font-normal text-slate-500">mg/dL</span></span>
                ) : (
                  <span className="text-slate-400 font-normal">Pending</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
