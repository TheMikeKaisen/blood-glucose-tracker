import React from 'react';
import { Plus, Edit2, Trash2, Sun, Coffee, Utensils, Moon } from 'lucide-react';
import type { TimeSlot, Reading } from '../../types/reading';
import { SLOT_CONFIG, evaluateGlucose } from '../../utils/clinical';

interface ReadingSlotCardProps {
  slot: TimeSlot;
  reading?: Reading;
  onAdd: (slot: TimeSlot) => void;
  onEdit: (reading: Reading) => void;
  onDelete: (reading: Reading) => void;
}

const SLOT_ICONS: Record<TimeSlot, React.ReactNode> = {
  morning_fasting: <Sun className="w-4 h-4 text-amber-500" />,
  after_breakfast: <Coffee className="w-4 h-4 text-orange-500" />,
  after_lunch: <Utensils className="w-4 h-4 text-teal-600" />,
  after_dinner: <Moon className="w-4 h-4 text-indigo-500" />,
};

export const ReadingSlotCard: React.FC<ReadingSlotCardProps> = ({
  slot,
  reading,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const config = SLOT_CONFIG[slot];
  const evalResult = reading ? evaluateGlucose(reading.value, slot) : null;

  return (
    <div
      className={`relative rounded-2xl p-4 transition-transform border ${
        reading
          ? 'bg-white border-slate-200/90 shadow-xs'
          : 'bg-white/60 border-dashed border-slate-300 hover:border-teal-400'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            {SLOT_ICONS[slot]}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              {config.label}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Target: {config.isFasting ? '70–99 mg/dL' : '< 140 mg/dL'}
            </span>
          </div>
        </div>

        {evalResult && (
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${evalResult.badgeClass}`}
          >
            {evalResult.label}
          </span>
        )}
      </div>

      {reading ? (
        <div className="flex items-end justify-between pt-1 border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block mb-0.5">Recorded value</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {reading.value}
              </span>
              <span className="text-xs font-semibold text-slate-500">mg/dL</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(reading)}
              title={`Edit ${config.label}`}
              aria-label={`Edit ${config.label}`}
              className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-xl min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-transform active:scale-95"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(reading)}
              title={`Delete ${config.label}`}
              aria-label={`Delete ${config.label}`}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-transform active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onAdd(slot)}
            className="w-full flex items-center justify-center gap-1.5 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold text-teal-800 bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200/50 transition-transform active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>Record {config.shortLabel} Reading</span>
          </button>
        </div>
      )}
    </div>
  );
};
