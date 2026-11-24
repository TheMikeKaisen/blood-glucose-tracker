import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';
import {
  formatFriendlyDate,
  formatFullDate,
  addDays,
  isToday,
  getTodayDateString,
} from '../../utils/date';

interface DateBarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const DateBar: React.FC<DateBarProps> = ({ selectedDate, onSelectDate }) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const today = getTodayDateString();
  const isSelectedToday = isToday(selectedDate);

  const handlePrevDay = () => {
    onSelectDate(addDays(selectedDate, -1));
  };

  const handleNextDay = () => {
    if (!isSelectedToday) {
      onSelectDate(addDays(selectedDate, 1));
    }
  };

  const handleTodayClick = () => {
    onSelectDate(today);
  };

  const handleCalendarPickerClick = () => {
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
    <div className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200/90 mb-4">
      <div className="flex items-center justify-between gap-2">
        {/* Previous Day Button */}
        <button
          type="button"
          onClick={handlePrevDay}
          title="Previous Day"
          aria-label="Previous Day"
          className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-transform active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Date Display and Picker */}
        <div className="flex-1 flex flex-col items-center text-center relative">
          <button
            type="button"
            onClick={handleCalendarPickerClick}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-50 min-h-[44px]"
          >
            <CalendarIcon className="w-4 h-4 text-teal-700 group-hover:scale-105" />
            <div className="text-left sm:text-center">
              <span className="text-sm font-bold text-slate-900 block leading-tight">
                {formatFriendlyDate(selectedDate)}
              </span>
              <span className="text-[11px] text-slate-500 font-medium block">
                {formatFullDate(selectedDate)}
              </span>
            </div>
          </button>

          {/* Hidden HTML5 Native Date Picker */}
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) {
                onSelectDate(e.target.value);
              }
            }}
            className="sr-only"
            aria-label="Select date"
          />
        </div>

        {/* Next Day Button (Disabled if viewing today) */}
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

      {/* Jump to Today Pill if browsing a past date */}
      {!isSelectedToday && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-center">
          <button
            type="button"
            onClick={handleTodayClick}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-transform active:scale-95 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Jump to Today</span>
          </button>
        </div>
      )}
    </div>
  );
};
