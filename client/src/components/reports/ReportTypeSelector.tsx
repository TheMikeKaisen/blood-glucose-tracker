import React, { useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReportType } from '../../types/report';
import { getTodayDateString, addDays, isToday, formatRangeLabel } from '../../utils/date';

interface ReportTypeSelectorProps {
  type: ReportType;
  onChangeType: (type: ReportType) => void;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  dateFrom?: string;
  dateTo?: string;
}

export const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({
  type,
  onChangeType,
  selectedDate,
  onChangeDate,
  dateFrom,
  dateTo,
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const today = getTodayDateString();
  const isSelectedToday = isToday(selectedDate);

  const reportOptions: { id: ReportType; label: string; sub: string }[] = [
    { id: 'daily', label: 'Daily', sub: 'Selected date' },
    { id: 'month_to_date', label: 'Month-to-Date', sub: '1st to date' },
    { id: 'monthly', label: 'Monthly', sub: 'Previous month' },
  ];

  const handlePrevDay = () => {
    onChangeDate(addDays(selectedDate, -1));
  };

  const handleNextDay = () => {
    if (!isSelectedToday) {
      onChangeDate(addDays(selectedDate, 1));
    }
  };

  const openDatePicker = () => {
    if (dateInputRef.current) {
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          dateInputRef.current.showPicker();
        } catch {
          dateInputRef.current.focus();
        }
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200/90 mb-4 space-y-3">
      {/* Timeframe Segmented Control */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/90 rounded-xl">
        {reportOptions.map((opt) => {
          const isActive = type === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeType(opt.id)}
              className={`min-h-[44px] py-2 px-2 rounded-lg text-xs font-bold transition-transform active:scale-95 text-center ${
                isActive
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="block leading-tight">{opt.label}</span>
              <span className="text-[10px] font-normal text-slate-500 block">
                {opt.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Date Anchor and Range Badge */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={handlePrevDay}
          title="Previous Day"
          aria-label="Previous Day"
          className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-transform active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 text-center">
          <button
            type="button"
            onClick={openDatePicker}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-50 min-h-[44px]"
          >
            <Calendar className="w-4 h-4 text-teal-700" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Anchor: {selectedDate}
              </span>
              {dateFrom && dateTo && (
                <span className="text-[11px] font-semibold text-teal-700 block">
                  Range: {formatRangeLabel(dateFrom, dateTo)}
                </span>
              )}
            </div>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) {
                onChangeDate(e.target.value);
              }
            }}
            className="sr-only"
            aria-label="Anchor date for report"
          />
        </div>

        <button
          type="button"
          onClick={handleNextDay}
          disabled={isSelectedToday}
          title={isSelectedToday ? 'Date cannot be in the future' : 'Next Day'}
          aria-label={isSelectedToday ? 'Date cannot be in the future' : 'Next Day'}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-transform active:scale-95"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
