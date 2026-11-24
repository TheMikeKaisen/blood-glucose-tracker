import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import type { TimeSlot, Reading } from '../../types/reading';
import { CHRONOLOGICAL_SLOTS, SLOT_CONFIG, evaluateGlucose } from '../../utils/clinical';
import { isFutureDate, isValidDateString, getTodayDateString } from '../../utils/date';
import { ApiError } from '../../services/api';

interface ReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { date: string; slot: TimeSlot; value: number }) => Promise<void>;
  initialSlot?: TimeSlot;
  initialDate: string;
  existingReading?: Reading | null;
  existingReadingsForDate: Reading[];
}

export const ReadingModal: React.FC<ReadingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialSlot,
  initialDate,
  existingReading,
  existingReadingsForDate,
}) => {
  const isEditing = !!existingReading;

  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<TimeSlot>(initialSlot || 'morning_fasting');
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check whether the active date matches the parent's selected date
  const isViewingInitialDate = date === initialDate;

  // Map of logged slots on selected date to prevent duplicates (excluding self if editing)
  const loggedSlots = new Set<TimeSlot>();
  if (isViewingInitialDate) {
    existingReadingsForDate.forEach((r) => {
      if (!isEditing || r.id !== existingReading?.id) {
        loggedSlots.add(r.slot);
      }
    });
  }

  // Find first unlogged slot for initialDate
  const getFirstAvailableSlot = (targetSlot?: TimeSlot): TimeSlot => {
    if (targetSlot && !loggedSlots.has(targetSlot)) {
      return targetSlot;
    }
    for (const s of CHRONOLOGICAL_SLOTS) {
      if (!loggedSlots.has(s)) return s;
    }
    return targetSlot || 'morning_fasting';
  };

  // Sync form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDate(initialDate);
      if (existingReading) {
        setSlot(existingReading.slot);
        setValue(String(existingReading.value));
      } else {
        const availableSlot = getFirstAvailableSlot(initialSlot);
        setSlot(availableSlot);
        setValue('');
      }
    }
  }, [isOpen, initialDate, initialSlot, existingReading]);

  // Numeric value parsed for live ADA preview
  const trimmedValue = value.trim();
  const isValidIntegerFormat = /^\d+$/.test(trimmedValue);
  const numValue = isValidIntegerFormat ? Number(trimmedValue) : null;
  const isValidNumber =
    numValue !== null && !isNaN(numValue) && Number.isInteger(numValue) && numValue >= 40 && numValue <= 600;

  const liveEvaluation = isValidNumber ? evaluateGlucose(numValue, slot) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Strict calendar date validity
    if (!date || !isValidDateString(date)) {
      setError('Please provide a valid date in YYYY-MM-DD format.');
      return;
    }

    // 2. Future date check
    if (isFutureDate(date)) {
      setError('Date cannot be in the future.');
      return;
    }

    // 3. Presence check
    const trimmed = value.trim();
    if (trimmed === '') {
      setError('Please enter a glucose value.');
      return;
    }

    // 4. Whole number and range validation (40 to 600 mg/dL)
    if (!/^\d+$/.test(trimmed)) {
      setError('Value must be between 40 and 600 mg/dl.');
      return;
    }

    const parsedVal = Number(trimmed);
    if (parsedVal < 40 || parsedVal > 600) {
      setError('Value must be between 40 and 600 mg/dl.');
      return;
    }

    // 5. Date-specific slot and count validation (only enforced client-side when viewing initialDate)
    if (isViewingInitialDate) {
      // Check max 4 readings (only for new additions, checked before duplicate slot)
      if (!isEditing && existingReadingsForDate.length >= 4) {
        setError('You can add only 4 readings per day.');
        return;
      }

      // Check duplicate slot
      if (loggedSlots.has(slot)) {
        const slotLabel = SLOT_CONFIG[slot].label;
        setError(`You already have an ${slotLabel} reading for this date.`);
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        date,
        slot,
        value: parsedVal,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save reading. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Glucose Reading' : 'Record Blood Glucose'}
      description="Enter whole number blood glucose value in mg/dL for the selected meal slot."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl"
          >
            {error}
          </div>
        )}

        {/* Date Field */}
        <div>
          <label htmlFor="reading-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Date
          </label>
          <input
            id="reading-date"
            type="date"
            value={date}
            max={getTodayDateString()}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full min-h-[44px] px-3.5 py-2.5 bg-white text-slate-900 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </div>

        {/* Meal Slot Field */}
        <div>
          <label htmlFor="reading-slot" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Circadian Meal Slot
          </label>
          <select
            id="reading-slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value as TimeSlot)}
            className="w-full min-h-[44px] px-3.5 py-2.5 bg-white text-slate-900 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          >
            {CHRONOLOGICAL_SLOTS.map((s) => {
              const cfg = SLOT_CONFIG[s];
              const isAlreadyLogged = loggedSlots.has(s);
              return (
                <option key={s} value={s} disabled={isAlreadyLogged}>
                  {cfg.label} {isAlreadyLogged ? '(Already logged)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Glucose Value Field */}
        <div>
          <Input
            id="reading-glucose-value"
            label="Blood Glucose (mg/dL)"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 95"
            unit="mg/dL"
            hint="Normal fasting is 70–99 mg/dL; post-meal is < 140 mg/dL"
          />
        </div>

        {/* Live ADA Target Guideline Preview Pill */}
        {liveEvaluation && (
          <div className={`p-3 rounded-xl border text-xs ${liveEvaluation.badgeClass}`}>
            <div className="flex items-center justify-between font-bold mb-0.5">
              <span>ADA Evaluation:</span>
              <span>{liveEvaluation.label}</span>
            </div>
            <p className="text-[11px] opacity-90">{liveEvaluation.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Save Changes' : 'Record Reading'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
